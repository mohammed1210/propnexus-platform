from __future__ import annotations

import inspect
import os
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlencode

try:
    import aiohttp
except ModuleNotFoundError:
    aiohttp = None
from bs4 import BeautifulSoup

from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.render import (
    PLAYWRIGHT_ENABLE,
    capture_debug_html,
    capture_debug_json,
    render_page_capture,
)
from backend.utils.retry import retry_async
from backend.utils.runlog import RunLog
from backend.utils.scraper_logger import (
    ScraperStats,
    log_image_extraction,
    log_page_fetch_error,
    log_scrape_start,
    log_scraperapi_fallback,
)
from backend.utils.validation import clean_property_data, should_insert_property

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "robot"]

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
OT_MAX_PAGES = int(os.getenv("OT_MAX_PAGES", "1"))
OT_DELAY_MS = int(os.getenv("OT_DELAY_MS", "900"))  # delay between pages (ms)
SCRAPERAPI_BASE = "https://api.scraperapi.com/"


def make_scraperapi_url(target_url: str, *, render: bool = False) -> str:
    """
    Build a ScraperAPI URL for the given target URL.

    If SCRAPERAPI_KEY is not set, returns the original target_url unchanged
    so the caller can fall back to direct requests.

    Args:
        target_url: The URL to scrape
        render: Whether to enable JavaScript rendering (default: False)

    Returns:
        ScraperAPI proxy URL if key is set, otherwise the original target_url
    """
    api_key = os.getenv("SCRAPERAPI_KEY", "").strip()
    if not api_key:
        return target_url

    params = {
        "api_key": api_key,
        "country_code": "gb",
        "url": target_url,
    }
    if render:
        params["render"] = "true"
        params["device_type"] = "desktop"

    return f"{SCRAPERAPI_BASE}?{urlencode(params)}"


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
        return f"{base}?view=grid&page={page + 1}"
    return f"{base}?view=grid"


async def _fetch_html_internal(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-GB,en;q=0.9"}

    # Determine which URL to fetch based on SCRAPER_MODE
    mode = os.getenv("SCRAPER_MODE", "direct").lower()

    if mode == "scraperapi":
        # Use ScraperAPI mode - wrap the URL with ScraperAPI
        if not SCRAPERAPI_KEY:
            # No API key configured, fall back to direct with warning
            print(
                "⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set, falling back to direct fetch"
            )
            url_to_fetch = url
        else:
            # Use ScraperAPI with rendering for HTML fallback
            url_to_fetch = make_scraperapi_url(url, render=True)
            print(f"ℹ️ Using ScraperAPI for OnTheMarket HTML fetch: {url}")
    else:
        # Direct mode - use original URL
        url_to_fetch = url

    # Fetch the URL (either direct or via ScraperAPI)
    try:
        timeout_value = 60 if mode == "scraperapi" else 30
        req = session.get(url_to_fetch, headers=headers, timeout=timeout_value)

        # If tests mock session.get as AsyncMock, req is awaitable.
        if inspect.isawaitable(req):
            req = await req

        async with req as resp:
            text = await resp.text()
            status = getattr(resp, "status", 0)

            # If direct mode and we detect blocking, try ScraperAPI as fallback
            if mode == "direct" and _looks_blocked(text, status) and SCRAPERAPI_KEY:
                log_scraperapi_fallback("onthemarket", url)
                proxy_url = make_scraperapi_url(url, render=True)
                print(f"ℹ️ Fallback to ScraperAPI for blocked URL: {url}")
                try:
                    proxy_req = session.get(proxy_url, headers=headers, timeout=60)
                    if inspect.isawaitable(proxy_req):
                        proxy_req = await proxy_req

                    async with proxy_req as p_resp:
                        p_text = await p_resp.text()
                        p_status = getattr(p_resp, "status", 0)

                        if _looks_blocked(p_text, p_status):
                            return None
                        return p_text
                except Exception:
                    return None

            # If still looks blocked, return None
            if _looks_blocked(text, status):
                return None

            return text
    except Exception as e:
        # On exception in scraperapi mode, we already tried ScraperAPI, so just fail
        if mode == "scraperapi":
            print(f"⚠️ ScraperAPI fetch failed: {e}")
            return None

        # On exception in direct mode, try ScraperAPI as fallback if available
        if SCRAPERAPI_KEY:
            print(f"⚠️ Direct fetch failed, trying ScraperAPI fallback: {e}")
            try:
                proxy_url = make_scraperapi_url(url, render=True)
                proxy_req = session.get(proxy_url, headers=headers, timeout=60)
                if inspect.isawaitable(proxy_req):
                    proxy_req = await proxy_req

                async with proxy_req as p_resp:
                    p_text = await p_resp.text()
                    p_status = getattr(p_resp, "status", 0)
                    if _looks_blocked(p_text, p_status):
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
            or img.get("src")
            or img.get("data-lazy-src")
            or img.get("data-original")
        )

        if url and isinstance(url, str):
            url = url.strip()
            if url and not any(x in url.lower() for x in ["placeholder", "blank", "1x1", "pixel"]):
                if url.startswith("//"):
                    url = "https:" + url
                elif url.startswith("/"):
                    url = "https://www.onthemarket.com" + url
                images.append(url)

    # Check srcset
    for img in card.select("img[srcset]"):
        srcset = img.get("srcset", "")
        if srcset:
            for item in srcset.split(","):
                parts = item.strip().split()
                if parts:
                    url = parts[0].strip()
                    if url and not any(x in url.lower() for x in ["placeholder", "blank", "1x1"]):
                        if url.startswith("//"):
                            url = "https:" + url
                        elif url.startswith("/"):
                            url = "https://www.onthemarket.com" + url
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
        card.select_one(".property-description")
        or card.select_one("[data-testid='description']")
        or card.select_one(".description")
        or card.select_one(".otm-Description")
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
    return f"ot-{hash(title + location) & 0xFFFFFFFF}"


async def scrape_onthemarket_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape OnTheMarket properties for a given location.

    Returns list of dicts with keys:
    - external_id, title, description, location, price, bedrooms, bathrooms,
      image_url, image_urls, latitude, longitude, source ("onthemarket"), raw_url
    """
    mode = os.getenv("SCRAPER_MODE", "direct").lower()

    if aiohttp is None:
        raise RuntimeError(
            "aiohttp is required for OnTheMarket scraping. Add aiohttp to requirements."
        )

    log_scrape_start("onthemarket", location, mode)
    stats = ScraperStats("onthemarket", location)
    results: List[Dict[str, Any]] = []
    seen_ids = set()

    with RunLog.start(
        source="onthemarket",
        mode=mode,
        location=location,
        meta={"max_pages": OT_MAX_PAGES},
    ) as runlog:
        try:
            async with aiohttp.ClientSession() as session:
                for page in range(OT_MAX_PAGES):
                    url = _build_search_url(location, page)
                    html = await _fetch_html(session, url)
                    if not html:
                        log_page_fetch_error("onthemarket", page, "blocked or empty")
                        continue

                    soup = BeautifulSoup(html, "html.parser")
                    cards = _collect_cards(soup)

                    if not cards:
                        if PLAYWRIGHT_ENABLE:
                            # Attempt network capture to extract JSON listing payloads
                            rendered, payloads = await render_page_capture(
                                url,
                                selectors=[
                                    ".property-card",
                                    "[data-testid='property-card']",
                                    ".listing-result",
                                ],
                                click_selectors=[
                                    "#ccc-recommended-settings",
                                    "#ccc-accept-settings",
                                ],
                                response_url_substrings=["/api/", "/search"],
                                max_json=10,
                            )
                            if rendered:
                                soup = BeautifulSoup(rendered, "html.parser")
                                cards = _collect_cards(soup)
                            if not cards and payloads:
                                # Heuristic parse of JSON payloads
                                extracted = _extract_from_otm_json(
                                    payloads, limit - len(results), location
                                )
                                for item in extracted:
                                    if item["external_id"] in seen_ids:
                                        stats.log_duplicate_id(item["external_id"])
                                        continue
                                    seen_ids.add(item["external_id"])
                                    should_insert, reason = should_insert_property(item)
                                    if should_insert:
                                        results.append(clean_property_data(item))
                                        stats.log_parse_success()
                                    else:
                                        stats.log_validation_failure(reason or "Unknown")
                                if extracted:
                                    print(
                                        f"✅ OnTheMarket JSON extracted {len(extracted)} properties"
                                    )
                            if not cards and not payloads:
                                if rendered:
                                    capture_debug_html(f"onthemarket_empty_{page}", rendered)
                        if not cards and len(results) == 0:
                            print(
                                f"ℹ️ OnTheMarket: No cards/json found on page {page}; stopping pagination."
                            )
                            break

                    for card in cards:
                        stats.log_card_found()
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
                            summary_el = card.select_one(
                                ".property-description"
                            ) or card.select_one(".summary")
                            summary_text = summary_el.get_text() if summary_el else ""
                            bed_match = re.search(r"(\d+)\s*bed", summary_text, re.IGNORECASE)
                            bedrooms = int(bed_match.group(1)) if bed_match else 0

                            # Extract bathrooms from summary text (e.g., "2 bath")
                            bath_match = re.search(r"(\d+)\s*bath", summary_text, re.IGNORECASE)
                            bathrooms = int(bath_match.group(1)) if bath_match else 0

                            # Extract all images
                            image_urls = _extract_images(card)
                            image_url = image_urls[0] if image_urls else None
                            log_image_extraction("onthemarket", title, len(image_urls))

                            # Extract description
                            description = _extract_description(card)

                            # Generate external ID
                            external_id = _extract_external_id(card, title, location_text)

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
                                "source": "onthemarket",
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
                    time.sleep(OT_DELAY_MS / 1000.0)

            stats.log_summary()
            print(f"✅ Scraped {len(results)} OnTheMarket properties for '{location}'")
            runlog.set_count(len(results))
            return results
        except Exception as e:
            # Let RunLog handle the error in __exit__
            print(f"❌ OnTheMarket scraper error: {e}")
            raise


def _extract_from_otm_json(
    payloads: List[Dict[str, Any]], limit: int, default_location: str
) -> List[Dict[str, Any]]:
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
                            pid = (
                                entry.get("id") or entry.get("propertyId") or entry.get("listingId")
                            )
                            addr = (
                                entry.get("address")
                                or entry.get("displayAddress")
                                or default_location
                            )

                            # Extract description
                            description = entry.get("description") or entry.get("summary") or None
                            if (
                                description
                                and isinstance(description, str)
                                and len(description) > 20
                            ):
                                description = description.strip()
                            else:
                                description = None

                            price_obj = entry.get("price") or {}
                            price = (
                                price_obj.get("amount")
                                or price_obj.get("price")
                                or entry.get("price")
                            )
                            if not pid or price is None:
                                continue
                            beds = entry.get("bedrooms") or entry.get("numBedrooms") or 0
                            baths = entry.get("bathrooms") or entry.get("numBathrooms") or 0

                            # Extract all images
                            image_urls = []
                            media = entry.get("media") or []
                            if isinstance(media, list):
                                for m in media:
                                    if isinstance(m, dict):
                                        img = m.get("url") or m.get("mediaUrl")
                                        if img and isinstance(img, str):
                                            image_urls.append(img)

                            img = image_urls[0] if image_urls else None

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
                                    "description": description,
                                    "location": addr,
                                    "price": price,
                                    "bedrooms": beds,
                                    "bathrooms": baths,
                                    "image_url": img,
                                    "image_urls": image_urls,
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
