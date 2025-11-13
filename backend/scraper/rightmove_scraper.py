import os
import re
import time
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup

from ..utils.postcode import get_lat_lng_from_postcode
from ..utils.render import render_page, PLAYWRIGHT_ENABLE, capture_debug_html, capture_debug_json
from ..utils.scraper_logger import ScraperStats, log_scrape_start, log_page_fetch_error, log_scraperapi_fallback, log_image_extraction
from ..utils.retry import retry_async
from ..utils.validation import validate_property_data, should_insert_property, clean_property_data

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "bot detection"]

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
RM_MAX_PAGES = int(os.getenv("RM_MAX_PAGES", "1"))
RM_DELAY_MS = int(os.getenv("RM_DELAY_MS", "800"))  # delay between pages (ms)
_LOCATION_IDENTIFIER = {
    # Common region codes; extend as needed (URL-encoded caret)
    "london": "REGION%5E87490",
}
RIGHTMOVE_API_BASE = "https://www.rightmove.co.uk/api/_search"


def _looks_blocked(html: str, status: int) -> bool:
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _build_search_url(location: str, page: int = 0) -> str:
    """
    Rightmove listing pages use paginationIndex. locationIdentifier can be derived
    via an initial search API call; for a generic free-text we rely on searchLocation.
    NOTE: For higher accuracy you may resolve locationIdentifier separately.
    """
    encoded = location.strip()
    loc_key = encoded.lower()
    base = "https://www.rightmove.co.uk/property-for-sale/find.html"
    params = [
        # Prefer region identifier when known; improves reliability
        f"locationIdentifier={_LOCATION_IDENTIFIER.get(loc_key, '')}" if loc_key in _LOCATION_IDENTIFIER else f"searchLocation={encoded}",
        "sortType=2",
        "propertyTypes=&mustHave=&dontShow=houseShare%2Cretirement%2CsharedOwnership",
        "furnishTypes=&keywords=",
        f"paginationIndex={page * 24}",  # Rightmove step size often 24
    ]
    return f"{base}?{'&'.join(params)}"


async def _fetch_html_internal(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    headers = {"User-Agent": USER_AGENT}
    # Direct fetch
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
                # Fallback to ScraperAPI
                log_scraperapi_fallback("rightmove", url)
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
        exceptions=(aiohttp.ClientError, asyncio.TimeoutError)
    )


def _parse_price(raw: str) -> Optional[int]:
    if not raw:
        return None
    cleaned = raw.replace("£", "").replace(",", "").strip()
    m = re.search(r"\d[\d,]*", cleaned)
    if not m:
        return None
    try:
        return int(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _extract_images(card: BeautifulSoup) -> List[str]:
    """Extract all image URLs from a property card.
    
    Args:
        card: BeautifulSoup element representing a property card
        
    Returns:
        List of valid image URLs
    """
    images = []
    
    # Try to find all images in the card
    for img in card.select("img"):
        # Try multiple attributes where images might be stored
        url = (
            img.get("data-src") or 
            img.get("src") or 
            img.get("data-lazy-src") or
            img.get("data-original")
        )
        
        if url and isinstance(url, str):
            url = url.strip()
            # Skip placeholder/tracking pixels
            if url and not any(x in url.lower() for x in ['placeholder', 'blank', '1x1', 'pixel']):
                # Make relative URLs absolute
                if url.startswith('//'):
                    url = 'https:' + url
                elif url.startswith('/'):
                    url = 'https://www.rightmove.co.uk' + url
                images.append(url)
    
    # Also check for srcset attribute which may have higher resolution images
    for img in card.select("img[srcset]"):
        srcset = img.get("srcset", "")
        if srcset:
            # Parse srcset format: "url1 width1, url2 width2, ..."
            for item in srcset.split(','):
                parts = item.strip().split()
                if parts:
                    url = parts[0].strip()
                    if url and not any(x in url.lower() for x in ['placeholder', 'blank', '1x1']):
                        if url.startswith('//'):
                            url = 'https:' + url
                        elif url.startswith('/'):
                            url = 'https://www.rightmove.co.uk' + url
                        images.append(url)
    
    # De-duplicate while preserving order
    seen = set()
    unique_images = []
    for img in images:
        if img not in seen:
            seen.add(img)
            unique_images.append(img)
    
    return unique_images


def _extract_description(card: BeautifulSoup) -> Optional[str]:
    """Extract property description from a card.
    
    Args:
        card: BeautifulSoup element representing a property card
        
    Returns:
        Description text or None
    """
    # Try various selectors for description
    desc_el = (
        card.select_one(".propertyCard-description") or
        card.select_one("[data-testid='description']") or
        card.select_one(".property-description") or
        card.select_one("[itemprop='description']")
    )
    
    if desc_el:
        desc = desc_el.get_text(" ", strip=True)
        # Return description if it's meaningful (more than just bedrooms/location)
        if desc and len(desc) > 20:
            return desc
    
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
        card.select_one(".propertyCard-propertyType") or
        card.select_one(".property-information") or
        card.select_one(".propertyType")
    )
    
    if type_el:
        type_text = type_el.get_text(" ", strip=True)
        return _normalize_property_type(type_text)
    
    # Try to extract from title or summary text
    title = card.select_one(".propertyCard-title, h2")
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
    
    # Check for common property types
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
    if 'studio' in lower:
        return 'studio'
    if 'maisonette' in lower:
        return 'maisonette'
    if 'cottage' in lower:
        return 'cottage'
    
    return None


def _extract_property_id(card: BeautifulSoup) -> Optional[str]:
    # Try data-id or an href containing property ID
    data_id = card.get("data-id")
    if data_id:
        return data_id
    link = card.select_one("a[href*='/properties/']")
    if link and link.get("href"):
        m = re.search(r"/properties/(\d+)", link.get("href"))
        if m:
            return m.group(1)
    return None


def _collect_selectors(soup: BeautifulSoup) -> List[BeautifulSoup]:
    selectors = [
        "[data-testid='propertyCard']",
        "[data-test='property-card']",
        ".propertyCard",
        "article.propertyCard",
    ]
    cards = []
    for sel in selectors:
        found = soup.select(sel)
        if found:
            cards.extend(found)
    # De-duplicate
    seen = set()
    unique_cards = []
    for c in cards:
        key = id(c)
        if key not in seen:
            seen.add(key)
            unique_cards.append(c)
    return unique_cards


async def _enrich_coordinates(location: str) -> Dict[str, float]:
    try:
        coords = await get_lat_lng_from_postcode(location)
        return {
            "latitude": coords.get("latitude", 0.0),
            "longitude": coords.get("longitude", 0.0),
        }
    except Exception:
        return {"latitude": 0.0, "longitude": 0.0}


async def scrape_rightmove_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape Rightmove properties for a given free-text location.
    Returns list of dicts suitable for Supabase upsert:
    - external_id, title, location, price, bedrooms, bathrooms, description, image_url, image_urls, latitude, longitude, source, raw_url
    """
    log_scrape_start("rightmove", location, SCRAPER_MODE)
    stats = ScraperStats("rightmove", location)
    results: List[Dict[str, Any]] = []

    async with aiohttp.ClientSession() as session:
        # 1. Attempt JSON API first for efficiency & reliability
        loc_key = location.lower()
        region_id = _LOCATION_IDENTIFIER.get(loc_key)
        api_results: List[Dict[str, Any]] = []
        if region_id:
            try:
                api_results = await _fetch_api_properties(session, region_id, limit)
                if api_results:
                    print(f"✅ Rightmove API returned {len(api_results)} properties for '{location}'")
                    # Validate and clean API results
                    validated_results = []
                    for prop in api_results:
                        should_insert, reason = should_insert_property(prop)
                        if should_insert:
                            validated_results.append(clean_property_data(prop))
                        else:
                            stats.log_validation_failure(reason or "Unknown")
                    stats.successful_parses = len(validated_results)
                    stats.log_summary()
                    return validated_results[:limit]
                else:
                    print("ℹ️ Rightmove API returned zero properties; falling back to HTML scraping.")
            except Exception as e:
                print(f"⚠️ Rightmove API fetch error: {e}; falling back to HTML scraping.")
        for page in range(RM_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            # Playwright fallback if enabled and static HTML yielded no cards later
            if not html:
                log_page_fetch_error("rightmove", page, "blocked or empty")
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_selectors(soup)
            if not cards:
                if PLAYWRIGHT_ENABLE:
                    rendered = await render_page(url, ["[data-testid='propertyCard']", "article.propertyCard", ".propertyCard"])
                    if rendered:
                        soup = BeautifulSoup(rendered, "html.parser")
                        cards = _collect_selectors(soup)
                        if not cards:
                            capture_debug_html(f"rightmove_empty_{page}", rendered)
                if not cards:
                    print("ℹ️ No cards found; stopping pagination.")
                    break

            for card in cards:
                stats.log_card_found()
                if len(results) >= limit:
                    break
                try:
                    title_el = (
                        card.select_one(".propertyCard-title")
                        or card.select_one("[data-testid='title']")
                        or card.select_one("h2")
                    )
                    title = title_el.get_text(strip=True) if title_el else "Untitled"

                    price_el = card.select_one(".propertyCard-priceValue") or card.select_one(
                        "[data-testid='price']"
                    )
                    price = _parse_price(price_el.get_text(strip=True) if price_el else "")

                    loc_el = (
                        card.select_one(".propertyCard-address")
                        or card.select_one("[data-testid='address']")
                        or card.select_one(".address")
                    )
                    location_text = loc_el.get_text(" ", strip=True) if loc_el else location

                    beds_el = (
                        card.select_one("[data-testid='bedrooms']")
                        or card.select_one(".beds")
                        or card.select_one(".propertyCard-description")
                    )
                    bedrooms = _extract_int(beds_el.get_text() if beds_el else "") or 0

                    baths_el = card.select_one("[data-testid='bathrooms']") or card.select_one(
                        ".baths"
                    )
                    bathrooms = _extract_int(baths_el.get_text() if baths_el else "") or 0

                    # Extract all images
                    image_urls = _extract_images(card)
                    image_url = image_urls[0] if image_urls else None
                    log_image_extraction("rightmove", title, len(image_urls))
                    
                    # Extract description
                    description = _extract_description(card)
                    
                    # Extract property type
                    property_type = _extract_property_type(card)

                    external_id = (
                        _extract_property_id(card) or f"rm-{hash(title+location_text) & 0xffffffff}"
                    )

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
                        "source": "rightmove",
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
            # polite delay
            time.sleep(RM_DELAY_MS / 1000.0)

    stats.log_summary()
    print(f"✅ Scraped {len(results)} Rightmove properties for '{location}'")
    return results


# Convenience wrapper matching previous signature (kept for backward compatibility)
async def scrape_rightmove_properties_default():
    return await scrape_rightmove_properties(location="London")


async def _fetch_api_properties(session: aiohttp.ClientSession, region_id: str, limit: int) -> List[Dict[str, Any]]:
    """Fetch properties via the undocumented Rightmove JSON search API.

    Endpoint example:
    https://www.rightmove.co.uk/api/_search?locationIdentifier=REGION%5E87490&numberOfPropertiesPerPage=24&sortType=2&index=0&channel=BUY
    We paginate by incrementing index in steps of 24 until limit reached or empty batch.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.rightmove.co.uk/",
    }
    out: List[Dict[str, Any]] = []
    page_size = 24
    index = 0
    while len(out) < limit:
        params = [
            f"locationIdentifier={region_id}",
            f"numberOfPropertiesPerPage={page_size}",
            "sortType=2",
            f"index={index}",
            "channel=BUY",
        ]
        url = f"{RIGHTMOVE_API_BASE}?{'&'.join(params)}"
        try:
            async with session.get(url, headers=headers, timeout=35) as resp:
                if resp.status != 200:
                    break
                data = await resp.json(content_type=None)
        except Exception:
            break
        if not data or "properties" not in data:
            capture_debug_json(f"rightmove_api_empty_{index}", data if isinstance(data, dict) else {"raw": str(data)})
            break
        props = data.get("properties", [])
        if not props:
            break
        for p in props:
            if len(out) >= limit:
                break
            try:
                property_id = str(p.get("id") or p.get("propertyId") or p.get("identifier") or p.get("listingId") or "")
                if not property_id:
                    continue
                title = p.get("displayAddress") or p.get("address") or p.get("summary") or "Untitled"
                
                # Extract description from summary or propertySubType
                description = p.get("summary") or p.get("propertySubType") or None
                if description and isinstance(description, str) and len(description) > 20:
                    description = description.strip()
                else:
                    description = None
                
                # Extract property type from API data
                property_type_raw = p.get("propertySubType") or p.get("propertyType") or ""
                property_type = _normalize_property_type(property_type_raw) if property_type_raw else None
                
                price_obj = p.get("price") or {}
                price = price_obj.get("amount") or price_obj.get("price") or None
                bedrooms = p.get("bedrooms") or p.get("numBedrooms") or 0
                bathrooms = p.get("bathrooms") or p.get("numBathrooms") or 0
                
                # Extract all images from media array
                image_urls = []
                media = p.get("media") or []
                if isinstance(media, list) and media:
                    for m in media:
                        if isinstance(m, dict):
                            img = m.get("url") or m.get("mediaUrl")
                            if img and isinstance(img, str):
                                image_urls.append(img)
                
                # Get primary image
                img = image_urls[0] if image_urls else None
                
                loc_text = title
                loc_lat = None
                loc_lng = None
                geo = p.get("location") or {}
                if isinstance(geo, dict):
                    loc_lat = geo.get("latitude")
                    loc_lng = geo.get("longitude")
                coords = {"latitude": loc_lat or 0.0, "longitude": loc_lng or 0.0}
                out.append(
                    {
                        "external_id": property_id,
                        "title": str(title).strip(),
                        "description": description,
                        "location": loc_text,
                        "price": price,
                        "bedrooms": bedrooms,
                        "bathrooms": bathrooms,
                        "property_type": property_type,
                        "image_url": img,
                        "image_urls": image_urls,
                        "latitude": coords["latitude"],
                        "longitude": coords["longitude"],
                        "source": "rightmove",
                        "raw_url": f"https://www.rightmove.co.uk/properties/{property_id}",
                    }
                )
            except Exception:
                continue
        # If fewer than page_size returned, stop early
        if len(props) < page_size:
            break
        index += page_size
        # Polite pacing
        await asyncio.sleep(0.5)
    if out:
        capture_debug_json("rightmove_api_batch", {"count": len(out)})
    return out
