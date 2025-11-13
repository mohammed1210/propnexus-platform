import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup

from ..utils.postcode import get_lat_lng_from_postcode
from ..utils.render import render_page, PLAYWRIGHT_ENABLE, capture_debug_html

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "bot detection"]

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
RM_MAX_PAGES = int(os.getenv("RM_MAX_PAGES", "1"))
RM_DELAY_MS = int(os.getenv("RM_DELAY_MS", "800"))  # delay between pages (ms)


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
    base = "https://www.rightmove.co.uk/property-for-sale/find.html"
    params = [
        f"searchLocation={encoded}",
        "sortType=2",
        "propertyTypes=&mustHave=&dontShow=houseShare%2Cretirement%2CsharedOwnership",
        "furnishTypes=&keywords=",
        f"paginationIndex={page * 24}",  # Rightmove step size often 24
    ]
    return f"{base}?{'&'.join(params)}"


async def _fetch_html(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    headers = {"User-Agent": USER_AGENT}
    # Direct fetch
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
                # Fallback to ScraperAPI
                proxy_url = (
                    f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}&country_code=gb"
                )
                async with session.get(proxy_url, headers=headers, timeout=45) as p_resp:
                    p_text = await p_resp.text()
                    if _looks_blocked(p_text, p_resp.status):
                        return None
                    return p_text
            return text
    except Exception:
        if SCRAPER_MODE == "scraperapi" and SCRAPERAPI_KEY:
            proxy_url = (
                f"http://api.scraperapi.com/?api_key={SCRAPERAPI_KEY}&url={url}&country_code=gb"
            )
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


def _extract_int(text: str) -> Optional[int]:
    if not text:
        return None
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


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
    - external_id, title, location, price, bedrooms, bathrooms, image_url, latitude, longitude, source, raw_url
    """
    print(f"🔍 Scraping Rightmove for location='{location}' (mode={SCRAPER_MODE})")
    results: List[Dict[str, Any]] = []

    async with aiohttp.ClientSession() as session:
        for page in range(RM_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            # Playwright fallback if enabled and static HTML yielded no cards later
            if not html:
                print(f"⚠️ Skipping page {page} (blocked or empty)")
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

                    img_el = card.select_one("img")
                    image_url = img_el.get("data-src") or img_el.get("src") if img_el else None

                    external_id = (
                        _extract_property_id(card) or f"rm-{hash(title+location_text) & 0xffffffff}"
                    )

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
                            "source": "rightmove",
                            "raw_url": url,
                        }
                    )
                except Exception as e:
                    print(f"❌ Error parsing a Rightmove card: {e}")
            if len(results) >= limit:
                break
            # polite delay
            time.sleep(RM_DELAY_MS / 1000.0)

    print(f"✅ Scraped {len(results)} Rightmove properties for '{location}'")
    return results


# Convenience wrapper matching previous signature (kept for backward compatibility)
async def scrape_rightmove_properties_default():
    return await scrape_rightmove_properties(location="London")
