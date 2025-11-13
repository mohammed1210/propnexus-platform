import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
import hashlib
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

from utils.postcode import get_lat_lng_from_postcode
from utils.scraper_logger import (
    ScraperStats,
    log_scrape_start,
    log_page_fetch_error,
    log_scraperapi_fallback,
    log_image_extraction,
)
from utils.retry import retry_async
from utils.validation import should_insert_property, clean_property_data

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "robot"]

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
SR_MAX_PAGES = int(os.getenv("SR_MAX_PAGES", "1"))
SR_DELAY_MS = int(os.getenv("SR_DELAY_MS", "900"))  # delay between pages (ms)


def _looks_blocked(html: str, status: int) -> bool:
    """Check if response indicates blocking or captcha."""
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _build_search_url(location: str, page: int = 0) -> str:
    """
    Build SpareRoom search URL for property listings.

    URL pattern: https://www.spareroom.co.uk/roommate/search.pl?location={encoded_location}&page={page+1}
    Focus on property listing cards with attributes; fall back to generic selectors.
    """
    encoded = quote_plus(location.strip())
    base = "https://www.spareroom.co.uk/flatshare/"
    if page > 0:
        return f"{base}?search_id=&location={encoded}&page={page+1}"
    return f"{base}?search_id=&location={encoded}"


async def _fetch_html_internal(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
                log_scraperapi_fallback("spareroom", url)
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
        exceptions=(aiohttp.ClientError,),
    )


def _parse_price(raw: str) -> Optional[int]:
    """Extract numeric price from string."""
    if not raw:
        return None
    cleaned = raw.replace("£", "").replace(",", "").strip()
    # Handle "pcm" or "pw" suffixes
    cleaned = re.sub(r"\s*(pcm|pw|per\s*week|per\s*month)", "", cleaned, flags=re.IGNORECASE)
    m = re.search(r"\d[\d,]*", cleaned)
    if not m:
        return None
    try:
        return int(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _extract_int(text: str) -> Optional[int]:
    """Extract first integer from text."""
    if not text:
        return None
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


def _extract_images(card: BeautifulSoup) -> List[str]:
    """Extract all image URLs from a property card."""
    images = []

    for img in card.select("img"):
        url = (
            img.get("data-src")
            or img.get("data-lazy")
            or img.get("src")
            or img.get("data-original")
        )

        if url and isinstance(url, str):
            url = url.strip()
            if url and not any(x in url.lower() for x in ["placeholder", "blank", "1x1", "pixel"]):
                if url.startswith("//"):
                    url = "https:" + url
                elif url.startswith("/"):
                    url = "https://www.spareroom.co.uk" + url
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
        card.select_one(".listing-description")
        or card.select_one(".description")
        or card.select_one("[data-testid='description']")
    )

    if desc_el:
        desc = desc_el.get_text(" ", strip=True)
        if desc and len(desc) > 20:
            return desc

    return None


def _collect_cards(soup: BeautifulSoup) -> List[BeautifulSoup]:
    """
    Collect property cards using multiple selector attempts.
    Defensive approach: try various class names and data attributes.
    """
    selectors = [
        "[data-testid='listing-card']",
        ".listing-result",
        "article.listing",
        "li.listing-result",
        ".search-result",
    ]
    cards = []
    for sel in selectors:
        found = soup.select(sel)
        if found:
            cards.extend(found)
    # De-duplicate by object id
    seen = set()
    unique = []
    for c in cards:
        key = id(c)
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


async def _enrich_coordinates(location: str) -> Dict[str, float]:
    """Get coordinates from postcode, best-effort."""
    try:
        coords = await get_lat_lng_from_postcode(location)
        if coords:
            return {
                "latitude": coords.get("latitude", 0.0),
                "longitude": coords.get("longitude", 0.0),
            }
        return {"latitude": 0.0, "longitude": 0.0}
    except Exception:
        return {"latitude": 0.0, "longitude": 0.0}


def _extract_external_id(card: BeautifulSoup, title: str, location: str, search_url: str) -> str:
    """
    Extract external ID from card. If not parseable, generate hash-based ID.
    """
    # Try data-id or href pattern
    # Common id attributes
    data_id = card.get("data-advert-id") or card.get("data-listing-id") or card.get("data-id")
    if data_id:
        return f"sr-{data_id}"

    # Try to extract from any link href
    link = card.select_one("a[href]")
    if link and link.get("href"):
        href = link.get("href")
        m = re.search(r"flatshare_id=(\d+)", href)
        if m:
            return f"sr-{m.group(1)}"
        m2 = re.search(r"(\d{6,})", href)
        if m2:
            return f"sr-{m2.group(1)}"

    # Fallback: stable hash of title+location+search_url+first_link
    basis = f"{title}|{location}|{search_url}|{link.get('href') if link else ''}"
    digest = hashlib.sha1(basis.encode("utf-8", errors="ignore")).hexdigest()[:10]
    return f"sr-{digest}"


async def scrape_spareroom_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape SpareRoom properties for a given location.

    Returns list of dicts with keys:
    - external_id, title, description, location, price, bedrooms, bathrooms,
      image_url, image_urls, latitude, longitude, source ("spareroom"), raw_url
    """
    log_scrape_start("spareroom", location, SCRAPER_MODE)
    stats = ScraperStats("spareroom", location)
    results: List[Dict[str, Any]] = []
    seen_ids = set()

    async with aiohttp.ClientSession() as session:
        for page in range(SR_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            if not html:
                log_page_fetch_error("spareroom", page, "blocked or empty")
                continue

            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_cards(soup)

            if not cards:
                print(f"ℹ️ SpareRoom: No cards found on page {page}; stopping pagination.")
                break

            for card in cards:
                stats.log_card_found()
                if len(results) >= limit:
                    break

                try:
                    # Extract title
                    title_el = (
                        card.select_one(".listing-title")
                        or card.select_one("h3")
                        or card.select_one("h2")
                    )
                    title = title_el.get_text(strip=True) if title_el else "Untitled"

                    # Extract price
                    price_el = (
                        card.select_one(".listingPrice")
                        or card.select_one(".listing-price")
                        or card.select_one(".price")
                    )
                    price = _parse_price(price_el.get_text(strip=True) if price_el else "")

                    # Extract location/address
                    loc_el = (
                        card.select_one(".listing-location")
                        or card.select_one(".location")
                        or card.select_one("address")
                    )
                    location_text = loc_el.get_text(" ", strip=True) if loc_el else location

                    # Extract bedrooms and bathrooms from description/attributes
                    desc_el = card.select_one(".listing-description") or card.select_one(
                        ".description"
                    )
                    desc_text = desc_el.get_text() if desc_el else card.get_text()

                    # Look for bedroom info (e.g., "3 bedroom" or "3 bed")
                    bed_match = re.search(r"(\d+)\s*bed(?:room)?s?", desc_text, re.IGNORECASE)
                    bedrooms = int(bed_match.group(1)) if bed_match else 0

                    # Look for bathroom info (e.g., "2 bathroom" or "2 bath")
                    bath_match = re.search(r"(\d+)\s*bath(?:room)?s?", desc_text, re.IGNORECASE)
                    bathrooms = int(bath_match.group(1)) if bath_match else 0

                    # Extract all images
                    image_urls = _extract_images(card)
                    image_url = image_urls[0] if image_urls else None
                    log_image_extraction("spareroom", title, len(image_urls))

                    # Extract description
                    description = _extract_description(card)

                    # Generate external ID
                    external_id = _extract_external_id(card, title, location_text, url)

                    # Deduplicate by external_id
                    if external_id in seen_ids:
                        stats.log_duplicate_id(external_id)
                        continue
                    seen_ids.add(external_id)

                    # Enrich with coordinates
                    coords = await _enrich_coordinates(location_text)

                    property_data = {
                        "external_id": external_id,
                        "title": title,
                        "description": description,
                        "location": location_text,
                        "price": price,
                        "bedrooms": bedrooms,
                        "bathrooms": bathrooms,
                        "image_url": image_url,
                        "image_urls": image_urls,
                        "latitude": coords["latitude"],
                        "longitude": coords["longitude"],
                        "source": "spareroom",
                        "raw_url": url,
                    }

                    # Track missing fields
                    if not image_url:
                        stats.log_missing_field("image_url", external_id)
                    if not description:
                        stats.log_missing_field("description", external_id)
                    if not price:
                        stats.log_missing_field("price", external_id)

                    # Validate before adding
                    should_insert, reason = should_insert_property(property_data)
                    if should_insert:
                        results.append(clean_property_data(property_data))
                        stats.log_parse_success()
                    else:
                        stats.log_validation_failure(reason or "Unknown")

                except Exception as e:
                    # Defensive: ignore parse exceptions
                    stats.log_parse_failure(str(e))

            if len(results) >= limit:
                break

            # Polite delay between pages
            time.sleep(SR_DELAY_MS / 1000.0)

    stats.log_summary()
    print(f"✅ Scraped {len(results)} SpareRoom properties for '{location}'")
    return results
