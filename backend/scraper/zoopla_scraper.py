import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from fastapi import BackgroundTasks

from ..utils.postcode import get_lat_lng_from_postcode
from ..utils.render import render_page, PLAYWRIGHT_ENABLE, capture_debug_html
from ..utils.scraper_logger import ScraperStats, log_scrape_start, log_page_fetch_error, log_scraperapi_fallback, log_image_extraction
from ..utils.retry import retry_async
from ..utils.validation import validate_property_data, should_insert_property, clean_property_data

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
ZP_MAX_PAGES = int(os.getenv("ZP_MAX_PAGES", "1"))
ZP_DELAY_MS = int(os.getenv("ZP_DELAY_MS", "900"))

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic"]


def _looks_blocked(html: str, status: int) -> bool:
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _build_search_url(location: str, page: int = 0) -> str:
    # Zoopla pagination uses ?page=2 etc.
    encoded = location.strip()
    base = f"https://www.zoopla.co.uk/for-sale/property/{encoded}/"
    if page > 0:
        return f"{base}?page={page+1}"
    return base


async def _fetch_html_internal(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
                log_scraperapi_fallback("zoopla", url)
                proxy_url = (
                    f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}"
                    f"&country_code=gb&render=true&device_type=desktop"
                )
                async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                    p_text = await p_resp.text()
                    if _looks_blocked(p_text, p_resp.status):
                        return None
                    return p_text
            return text
    except Exception:
        if SCRAPER_MODE == "scraperapi" and SCRAPERAPI_KEY:
            proxy_url = (
                f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}"
                f"&country_code=gb&render=true&device_type=desktop"
            )
            try:
                async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                    p_text = await p_resp.text()
                    if _looks_blocked(p_text, p_resp.status):
                        return None
                    return p_text
            except Exception:
                return None
        return None


async def _fetch_html(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Fetch HTML with retry logic and exponential backoff."""
    return await retry_async(
        _fetch_html_internal,
        session,
        url,
        max_retries=3,
        base_delay=2.0,
        exceptions=(aiohttp.ClientError,)
    )


def _parse_price(raw: str) -> Optional[int]:
    if not raw:
        return None
    raw = raw.replace("£", "").replace(",", "").strip()
    m = re.search(r"\d[\d,]*", raw)
    if not m:
        return None
    try:
        return int(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _extract_int(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


def _extract_property_type(card: BeautifulSoup) -> Optional[str]:
    """Extract property type from card element.
    
    Args:
        card: BeautifulSoup element representing a property card
        
    Returns:
        Property type string or None
    """
    # Try various selectors for property type
    type_el = (
        card.select_one("[data-testid='property-type']") or
        card.select_one(".listing-property-type") or
        card.select_one(".property-type") or
        card.select_one(".property-information")
    )
    
    if type_el:
        type_text = type_el.get_text(" ", strip=True)
        return _normalize_property_type(type_text)
    
    # Try to extract from title
    title = card.select_one("h2, [data-testid='listing-title']")
    if title:
        title_text = title.get_text(" ", strip=True)
        prop_type = _normalize_property_type(title_text)
        if prop_type:
            return prop_type
    
    return None


def _normalize_property_type(text: str) -> Optional[str]:
    """Normalize property type text to standard values.
    
    Args:
        text: Raw property type text
        
    Returns:
        Normalized property type or None
    """
    if not text:
        return None
    
    lower = text.lower()
    
    # Check for common property types (order matters - check studio before flat!)
    if 'studio' in lower:
        return 'studio'
    if 'flat' in lower or 'apartment' in lower:
        return 'flat'
    if 'detached' in lower and 'semi' not in lower:
        return 'detached'
    if 'semi-detached' in lower or 'semi detached' in lower:
        return 'semi-detached'
    if 'terraced' in lower:
        return 'terraced'
    if 'bungalow' in lower:
        return 'bungalow'
    if 'house' in lower:
        return 'house'
    if 'maisonette' in lower:
        return 'maisonette'
    if 'cottage' in lower:
        return 'cottage'
    
    return None


def _extract_images(card: BeautifulSoup) -> List[str]:
    """Extract all image URLs from a property card."""
    images = []
    
    for img in card.select("img"):
        url = (
            img.get("data-src") or 
            img.get("src") or 
            img.get("data-lazy-src") or
            img.get("data-original")
        )
        
        if url and isinstance(url, str):
            url = url.strip()
            if url and not any(x in url.lower() for x in ['placeholder', 'blank', '1x1', 'pixel']):
                if url.startswith('//'):
                    url = 'https:' + url
                elif url.startswith('/'):
                    url = 'https://www.zoopla.co.uk' + url
                images.append(url)
    
    # Check srcset
    for img in card.select("img[srcset]"):
        srcset = img.get("srcset", "")
        if srcset:
            for item in srcset.split(','):
                parts = item.strip().split()
                if parts:
                    url = parts[0].strip()
                    if url and not any(x in url.lower() for x in ['placeholder', 'blank', '1x1']):
                        if url.startswith('//'):
                            url = 'https:' + url
                        elif url.startswith('/'):
                            url = 'https://www.zoopla.co.uk' + url
                        images.append(url)
    
    # De-duplicate
    seen = set()
    unique_images = []
    for img in images:
        if img not in seen:
            seen.add(img)
            unique_images.append(img)
    
    return unique_images


def _extract_description(card: BeautifulSoup) -> Optional[str]:
    """Extract property description from a card."""
    desc_el = (
        card.select_one("[data-testid='listing-description']") or
        card.select_one(".listing-description") or
        card.select_one(".property-description") or
        card.select_one("[itemprop='description']")
    )
    
    if desc_el:
        desc = desc_el.get_text(" ", strip=True)
        if desc and len(desc) > 20:
            return desc
    
    return None


def _collect_cards(soup: BeautifulSoup) -> List[BeautifulSoup]:
    selectors = [
        ".l-searchResult",
        "[data-testid='search-result']",
        ".c-propertyCard",
        "div[data-testid='regular-listings'] article",
    ]
    cards = []
    for sel in selectors:
        found = soup.select(sel)
        if found:
            cards.extend(found)
    # De-duplicate by object id
    seen = set()
    uniq = []
    for c in cards:
        key = id(c)
        if key not in seen:
            seen.add(key)
            uniq.append(c)
    return uniq


async def _enrich_coordinates(location: str) -> Dict[str, float]:
    try:
        coords = await get_lat_lng_from_postcode(location)
        return {
            "latitude": coords.get("latitude", 0.0),
            "longitude": coords.get("longitude", 0.0),
        }
    except Exception:
        return {"latitude": 0.0, "longitude": 0.0}


def _extract_external_id(card: BeautifulSoup) -> str:
    link = card.select_one("a[href*='/for-sale/details/']")
    if link and link.get("href"):
        m = re.search(r"/for-sale/details/(\d+)", link.get("href"))
        if m:
            return m.group(1)
    return f"zp-{abs(hash(card.get_text()) % (10**9))}"


async def scrape_zoopla_properties(
    location: str, limit: int = 40, background_tasks: BackgroundTasks | None = None
) -> List[Dict[str, Any]]:
    log_scrape_start("zoopla", location, SCRAPER_MODE)
    stats = ScraperStats("zoopla", location)
    results: List[Dict[str, Any]] = []

    async with aiohttp.ClientSession() as session:
        for page in range(ZP_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            if not html:
                log_page_fetch_error("zoopla", page, "blocked or empty")
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_cards(soup)
            if not cards:
                if PLAYWRIGHT_ENABLE:
                    rendered = await render_page(url, ["[data-testid='search-result']", ".c-propertyCard", ".l-searchResult"])
                    if rendered:
                        soup = BeautifulSoup(rendered, "html.parser")
                        cards = _collect_cards(soup)
                        if not cards:
                            capture_debug_html(f"zoopla_empty_{page}", rendered)
                if not cards:
                    print("ℹ️ No Zoopla cards found; stopping.")
                    break

            for card in cards:
                stats.log_card_found()
                if len(results) >= limit:
                    break
                try:
                    title_el = card.select_one("h2") or card.select_one(
                        "[data-testid='listing-title']"
                    )
                    title = title_el.get_text(strip=True) if title_el else "Untitled"

                    price_el = (
                        card.select_one("[data-testid='listing-price']")
                        or card.select_one(".css-1w7b0tk-Price")
                        or card.select_one(".listing-price")
                    )
                    price = _parse_price(price_el.get_text(strip=True) if price_el else "")

                    loc_el = (
                        card.select_one("[data-testid='listing-description']")
                        or card.select_one(".listing-description")
                        or card.select_one("address")
                    )
                    location_text = loc_el.get_text(" ", strip=True) if loc_el else location

                    bed_el = (
                        card.select_one("[data-testid='bed']")
                        or card.select_one(".css-1rzse3v-Bedrooms")
                        or card.select_one(".listing-bedrooms")
                    )
                    bedrooms = _extract_int(bed_el.get_text() if bed_el else "") or 0

                    bath_el = card.select_one("[data-testid='bath']") or card.select_one(
                        ".listing-bathrooms"
                    )
                    bathrooms = _extract_int(bath_el.get_text() if bath_el else "") or 0

                    # Extract all images
                    image_urls = _extract_images(card)
                    image_url = image_urls[0] if image_urls else None
                    log_image_extraction("zoopla", title, len(image_urls))
                    
                    # Extract description
                    description = _extract_description(card)
                    
                    # Extract property type
                    property_type = _extract_property_type(card)

                    external_id = _extract_external_id(card)
                    coords = await _enrich_coordinates(location_text)

                    property_data = {
                        "external_id": external_id,
                        "title": title,
                        "description": description,
                        "location": location_text,
                        "price": price,
                        "bedrooms": bedrooms,
                        "bathrooms": bathrooms,
                        "property_type": property_type,
                        "image_url": image_url,
                        "image_urls": image_urls,
                        "latitude": coords["latitude"],
                        "longitude": coords["longitude"],
                        "source": "zoopla",
                        "raw_url": url,
                    }
                    
                    # Track missing fields
                    if not image_url:
                        stats.log_missing_field("image_url", external_id)
                    if not description:
                        stats.log_missing_field("description", external_id)
                    if not price:
                        stats.log_missing_field("price", external_id)
                    if not property_type:
                        stats.log_missing_field("property_type", external_id)
                    
                    # Validate before adding
                    should_insert, reason = should_insert_property(property_data)
                    if should_insert:
                        results.append(clean_property_data(property_data))
                        stats.log_parse_success()
                    else:
                        stats.log_validation_failure(reason or "Unknown")
                        
                except Exception as e:
                    stats.log_parse_failure(str(e))
            if len(results) >= limit:
                break
            time.sleep(ZP_DELAY_MS / 1000.0)

    stats.log_summary()
    print(f"✅ Scraped {len(results)} Zoopla properties for '{location}'")
    return results


# Backward-compatible stub signature
async def scrape_zoopla_properties_default(background_tasks: BackgroundTasks | None = None):
    return await scrape_zoopla_properties(location="London", background_tasks=background_tasks)
