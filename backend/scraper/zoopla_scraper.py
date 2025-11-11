import os
import re
import time
import aiohttp
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from fastapi import BackgroundTasks

from ..utils.postcode import get_lat_lng_from_postcode

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

async def _fetch_html(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}
    try:
        async with session.get(url, headers=headers, timeout=30) as resp:
            text = await resp.text()
            if _looks_blocked(text, resp.status) and SCRAPER_MODE == "direct" and SCRAPERAPI_KEY:
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

async def scrape_zoopla_properties(location: str, limit: int = 40, background_tasks: BackgroundTasks | None = None) -> List[Dict[str, Any]]:
    print(f"🔍 Scraping Zoopla for '{location}' (mode={SCRAPER_MODE})")
    results: List[Dict[str, Any]] = []

    async with aiohttp.ClientSession() as session:
        for page in range(ZP_MAX_PAGES):
            url = _build_search_url(location, page)
            html = await _fetch_html(session, url)
            if not html:
                print(f"⚠️ Page {page} blocked or empty.")
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = _collect_cards(soup)
            if not cards:
                print("ℹ️ No Zoopla cards found; stopping.")
                break

            for card in cards:
                if len(results) >= limit:
                    break
                try:
                    title_el = card.select_one("h2") or card.select_one("[data-testid='listing-title']")
                    title = title_el.get_text(strip=True) if title_el else "Untitled"

                    price_el = card.select_one("[data-testid='listing-price']") or card.select_one(".css-1w7b0tk-Price") or card.select_one(".listing-price")
                    price = _parse_price(price_el.get_text(strip=True) if price_el else "")

                    loc_el = card.select_one("[data-testid='listing-description']") or card.select_one(".listing-description") or card.select_one("address")
                    location_text = loc_el.get_text(" ", strip=True) if loc_el else location

                    bed_el = card.select_one("[data-testid='bed']") or card.select_one(".css-1rzse3v-Bedrooms") or card.select_one(".listing-bedrooms")
                    bedrooms = _extract_int(bed_el.get_text() if bed_el else "") or 0

                    bath_el = card.select_one("[data-testid='bath']") or card.select_one(".listing-bathrooms")
                    bathrooms = _extract_int(bath_el.get_text() if bath_el else "") or 0

                    img_el = card.select_one("img")
                    image_url = img_el.get("data-src") or img_el.get("src") if img_el else None

                    external_id = _extract_external_id(card)
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
                            "source": "zoopla",
                            "raw_url": url,
                        }
                    )
                except Exception as e:
                    print(f"❌ Error parsing Zoopla card: {e}")
            if len(results) >= limit:
                break
            time.sleep(ZP_DELAY_MS / 1000.0)

    print(f"✅ Scraped {len(results)} Zoopla properties for '{location}'")
    return results

# Backward-compatible stub signature
async def scrape_zoopla_properties_default(background_tasks: BackgroundTasks | None = None):
    return await scrape_zoopla_properties(location="London", background_tasks=background_tasks)
