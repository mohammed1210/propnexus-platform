import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

from ..utils.postcode import get_lat_lng_from_postcode

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

async def _fetch_html(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """
    Fetch HTML with direct mode first, fallback to ScraperAPI if blocked.
    """
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}
    # Direct fetch
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
                # Fallback to ScraperAPI
                proxy_url = f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}&country_code=gb"
                async with session.get(proxy_url, headers=headers, timeout=45) as p_resp:
                    p_text = await p_resp.text()
                    if _looks_blocked(p_text, p_resp.status):
                        return None
                    return p_text
            return text
    except Exception:
        if SCRAPER_MODE == "scraperapi" and SCRAPERAPI_KEY:
            proxy_url = f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}&country_code=gb"
            try:
                async with session.get(proxy_url, headers=headers, timeout=45) as p_resp:
                    p_text = await p_resp.text()
                    if _looks_blocked(p_text, p_resp.status):
                        return None
                    return p_text
            except Exception:
                return None
        return None

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

def _extract_external_id(card: BeautifulSoup, title: str, location: str) -> str:
    """
    Extract external ID from card. If not parseable, generate hash-based ID.
    """
    # Try data-id or href pattern
    data_id = card.get("data-id")
    if data_id:
        return f"sr-{data_id}"
    
    link = card.select_one("a[href*='/flatshare/flatshare_detail.pl']")
    if link and link.get("href"):
        m = re.search(r"flatshare_id=(\d+)", link.get("href"))
        if m:
            return f"sr-{m.group(1)}"
    
    # Fallback: hash of title + location
    return f"sr-{hash(title + location) & 0xffffffff}"

async def scrape_spareroom_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape SpareRoom properties for a given location.
    
    Returns list of dicts with keys:
    - external_id, title, location, price, bedrooms, bathrooms, 
      image_url, latitude, longitude, source ("spareroom"), raw_url
    """
    print(f"🔍 Scraping SpareRoom for location='{location}' (mode={SCRAPER_MODE})")
    results: List[Dict[str, Any]] = []
    seen_ids = set()

    async with aiohttp.ClientSession() as session:
        for page in range(SR_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            if not html:
                print(f"⚠️ SpareRoom: Skipping page {page} (blocked or empty)")
                continue
            
            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_cards(soup)
            
            if not cards:
                print(f"ℹ️ SpareRoom: No cards found on page {page}; stopping pagination.")
                break

            for card in cards:
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
                    desc_el = card.select_one(".listing-description") or card.select_one(".description")
                    desc_text = desc_el.get_text() if desc_el else card.get_text()
                    
                    # Look for bedroom info (e.g., "3 bedroom" or "3 bed")
                    bed_match = re.search(r"(\d+)\s*bed(?:room)?s?", desc_text, re.IGNORECASE)
                    bedrooms = int(bed_match.group(1)) if bed_match else 0

                    # Look for bathroom info (e.g., "2 bathroom" or "2 bath")
                    bath_match = re.search(r"(\d+)\s*bath(?:room)?s?", desc_text, re.IGNORECASE)
                    bathrooms = int(bath_match.group(1)) if bath_match else 0

                    # Extract image
                    img_el = card.select_one("img")
                    image_url = None
                    if img_el:
                        image_url = img_el.get("data-src") or img_el.get("data-lazy") or img_el.get("src")

                    # Generate external ID
                    external_id = _extract_external_id(card, title, location_text)
                    
                    # Deduplicate by external_id
                    if external_id in seen_ids:
                        continue
                    seen_ids.add(external_id)

                    # Enrich with coordinates
                    coords = await _enrich_coordinates(location_text)

                    results.append(
                        {
                            "external_id": external_id,
                            "title": title,
                            "location": location_text,
                            "price": price,
                            "bedrooms": bedrooms,
                            "bathrooms": bathrooms,
                            "image_url": image_url,
                            "latitude": coords["latitude"],
                            "longitude": coords["longitude"],
                            "source": "spareroom",
                            "raw_url": url,
                        }
                    )
                except Exception as e:
                    # Defensive: ignore parse exceptions
                    print(f"❌ SpareRoom: Error parsing card: {e}")
            
            if len(results) >= limit:
                break
            
            # Polite delay between pages
            time.sleep(SR_DELAY_MS / 1000.0)

    print(f"✅ Scraped {len(results)} SpareRoom properties for '{location}'")
    return results
