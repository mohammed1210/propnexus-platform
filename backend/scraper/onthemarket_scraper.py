import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

from ..utils.postcode import get_lat_lng_from_postcode
from ..utils.render import render_page, PLAYWRIGHT_ENABLE, render_page_capture
from ..utils.render import capture_debug_html, capture_debug_json

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "robot"]

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
OT_MAX_PAGES = int(os.getenv("OT_MAX_PAGES", "1"))
OT_DELAY_MS = int(os.getenv("OT_DELAY_MS", "900"))  # delay between pages (ms)


def _looks_blocked(html: str, status: int) -> bool:
    """Check if response indicates blocking or captcha."""
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _build_search_url(location: str, page: int = 0) -> str:
    """
    Build OnTheMarket search URL for property listings.

    URL pattern: https://www.onthemarket.com/for-sale/property/{encoded_location}/?view=grid&page={page+1}
    Note: If markup changes, scraper may yield 0 results; logging will warn.
    """
    encoded = quote_plus(location.strip())
    base = f"https://www.onthemarket.com/for-sale/property/{encoded}/"
    if page > 0:
        return f"{base}?view=grid&page={page+1}"
    return f"{base}?view=grid"


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
    """Extract numeric price from string."""
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
        "[data-testid='property-card']",
        ".property-card",
        ".otm-PropertyCard",
        "article.property-result",
        ".property-result",
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
        return f"ot-{data_id}"

    link = card.select_one("a[href*='/details/']")
    if link and link.get("href"):
        m = re.search(r"/details/(\d+)", link.get("href"))
        if m:
            return f"ot-{m.group(1)}"

    # Fallback: hash of title + location
    return f"ot-{hash(title + location) & 0xffffffff}"


async def scrape_onthemarket_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape OnTheMarket properties for a given location.

    Returns list of dicts with keys:
    - external_id, title, location, price, bedrooms, bathrooms,
      image_url, latitude, longitude, source ("onthemarket"), raw_url
    """
    print(f"🔍 Scraping OnTheMarket for location='{location}' (mode={SCRAPER_MODE})")
    results: List[Dict[str, Any]] = []
    seen_ids = set()

    async with aiohttp.ClientSession() as session:
        for page in range(OT_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            if not html:
                print(f"⚠️ OnTheMarket: Skipping page {page} (blocked or empty)")
                continue

            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_cards(soup)

            if not cards:
                if PLAYWRIGHT_ENABLE:
                    # Attempt network capture to extract JSON listing payloads
                    rendered, payloads = await render_page_capture(
                        url,
                        selectors=[".property-card", "[data-testid='property-card']", ".listing-result"],
                        click_selectors=["#ccc-recommended-settings", "#ccc-accept-settings"],
                        response_url_substrings=["/api/", "/search"],
                        max_json=10,
                    )
                    if rendered:
                        soup = BeautifulSoup(rendered, "html.parser")
                        cards = _collect_cards(soup)
                    if not cards and payloads:
                        # Heuristic parse of JSON payloads
                        extracted = _extract_from_otm_json(payloads, limit - len(results), location)
                        for item in extracted:
                            if item["external_id"] in seen_ids:
                                continue
                            seen_ids.add(item["external_id"])
                            results.append(item)
                        if extracted:
                            print(f"✅ OnTheMarket JSON extracted {len(extracted)} properties")
                    if not cards and not payloads:
                        if rendered:
                            capture_debug_html(f"onthemarket_empty_{page}", rendered)
                if not cards and len(results) == 0:
                    print(f"ℹ️ OnTheMarket: No cards/json found on page {page}; stopping pagination.")
                    break

            for card in cards:
                if len(results) >= limit:
                    break

                try:
                    # Extract title
                    title_el = (
                        card.select_one("[data-testid='title']")
                        or card.select_one("h2")
                        or card.select_one(".title")
                    )
                    title = title_el.get_text(strip=True) if title_el else "Untitled"

                    # Extract price
                    price_el = (
                        card.select_one("[data-testid='price']")
                        or card.select_one(".price")
                        or card.select_one(".otm-Price")
                    )
                    price = _parse_price(price_el.get_text(strip=True) if price_el else "")

                    # Extract location/address
                    loc_el = (
                        card.select_one("[data-testid='address']")
                        or card.select_one(".address")
                        or card.select_one(".otm-Address")
                    )
                    location_text = loc_el.get_text(" ", strip=True) if loc_el else location

                    # Extract bedrooms from summary text (e.g., "3 bed")
                    summary_el = card.select_one(".property-description") or card.select_one(
                        ".summary"
                    )
                    summary_text = summary_el.get_text() if summary_el else ""
                    bed_match = re.search(r"(\d+)\s*bed", summary_text, re.IGNORECASE)
                    bedrooms = int(bed_match.group(1)) if bed_match else 0

                    # Extract bathrooms from summary text (e.g., "2 bath")
                    bath_match = re.search(r"(\d+)\s*bath", summary_text, re.IGNORECASE)
                    bathrooms = int(bath_match.group(1)) if bath_match else 0

                    # Extract image
                    img_el = card.select_one("img")
                    image_url = img_el.get("data-src") or img_el.get("src") if img_el else None

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
                            "source": "onthemarket",
                            "raw_url": url,
                        }
                    )
                except Exception as e:
                    # Defensive: ignore parse exceptions
                    print(f"❌ OnTheMarket: Error parsing card: {e}")

            if len(results) >= limit:
                break

            # Polite delay between pages
            time.sleep(OT_DELAY_MS / 1000.0)

    print(f"✅ Scraped {len(results)} OnTheMarket properties for '{location}'")
    return results


def _extract_from_otm_json(payloads: List[Dict[str, Any]], limit: int, default_location: str) -> List[Dict[str, Any]]:
    """Attempt to find listing arrays inside captured JSON payloads.
    Heuristic: look for arrays with objects containing price/address/id fields.
    """
    out: List[Dict[str, Any]] = []
    keys_candidates = ["listings", "properties", "results", "data"]
    for payload in payloads:
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            continue
        # Search nested dict for candidate arrays
        stack = [data]
        while stack and len(out) < limit:
            current = stack.pop()
            if isinstance(current, dict):
                for k, v in current.items():
                    if isinstance(v, list) and k.lower() in keys_candidates:
                        for entry in v:
                            if len(out) >= limit:
                                break
                            if not isinstance(entry, dict):
                                continue
                            # Basic fields
                            pid = entry.get("id") or entry.get("propertyId") or entry.get("listingId")
                            addr = entry.get("address") or entry.get("displayAddress") or default_location
                            price_obj = entry.get("price") or {}
                            price = price_obj.get("amount") or price_obj.get("price") or entry.get("price")
                            if not pid or price is None:
                                continue
                            beds = entry.get("bedrooms") or entry.get("numBedrooms") or 0
                            baths = entry.get("bathrooms") or entry.get("numBathrooms") or 0
                            img = None
                            media = entry.get("media") or []
                            if isinstance(media, list):
                                for m in media:
                                    if isinstance(m, dict):
                                        img = m.get("url") or m.get("mediaUrl") or img
                                        if img:
                                            break
                            loc_lat = None
                            loc_lng = None
                            loc = entry.get("location") or {}
                            if isinstance(loc, dict):
                                loc_lat = loc.get("latitude")
                                loc_lng = loc.get("longitude")
                            out.append(
                                {
                                    "external_id": f"ot-{pid}",
                                    "title": addr,
                                    "location": addr,
                                    "price": price,
                                    "bedrooms": beds,
                                    "bathrooms": baths,
                                    "image_url": img,
                                    "latitude": loc_lat or 0.0,
                                    "longitude": loc_lng or 0.0,
                                    "source": "onthemarket",
                                    "raw_url": f"https://www.onthemarket.com/details/{pid}",
                                }
                            )
                    elif isinstance(v, dict):
                        stack.append(v)
            # Ignore other types
        if len(out) >= limit:
            break
    if out:
        capture_debug_json("otm_json_summary", {"count": len(out)})
    return out
