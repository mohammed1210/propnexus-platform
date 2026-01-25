import asyncio
import hashlib
import inspect
import os
import random
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlencode

import aiohttp
from bs4 import BeautifulSoup

from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.retry import retry_async
from backend.utils.runlog import RunLog
from backend.utils.scraper_logger import (
    ScraperStats,
    log_fetch_diagnostics,
    log_image_extraction,
    log_page_fetch_error,
    log_scrape_start,
    log_scraperapi_fallback,
)
from backend.utils.validation import clean_property_data, should_insert_property

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

# NOTE: Avoid overly-broad markers like "robot" which cause false positives due to
# common meta tags (e.g. <meta name="robots" ...>) on normal pages.
CAPTCHA_KEYWORDS = [
    "captcha",
    "access denied",
    "unusual traffic",
    "verify you are human",
    "are you a robot",
    "i am not a robot",
]


def _has_cloudflare_marker(text: str) -> bool:
    lowered = (text or "").lower()
    # Avoid false positives from Cloudflare analytics/beacons.
    if "cdn-cgi" in lowered or "/cdn-cgi/" in lowered:
        return True
    return any(
        marker in lowered
        for marker in (
            "challenge-platform",
            "cf-chl-",
            "cf_chl_",
            "checking your browser before accessing",
            "please wait while we check your browser",
            "attention required! | cloudflare",
            "ddos protection by cloudflare",
            "turnstile",
        )
    )


_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)


def _looks_like_postcode(s: str) -> bool:
    return bool(s and _POSTCODE_RE.search(s))


SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
SR_MAX_PAGES = int(os.getenv("SR_MAX_PAGES", "1"))
SR_DELAY_MS = int(os.getenv("SR_DELAY_MS", "900"))  # delay between pages (ms)
SCRAPERAPI_BASE = "https://api.scraperapi.com/"


def make_scraperapi_url(
    target_url: str,
    *,
    render: bool = True,
    premium: bool = False,
    session_number: Optional[str] = None,
) -> str:
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
        "render": "true" if render else None,
        "country_code": "gb",
        "keep_headers": "true",
        "premium": "true" if premium else None,
        "url": target_url,
    }

    params = {k: v for k, v in params.items() if v is not None}

    if render:
        params["device_type"] = "desktop"

    if session_number:
        params["session_number"] = str(session_number)
    else:
        session_fixed = (os.getenv("SCRAPERAPI_SESSION_NUMBER") or "").strip()
        session_random = (os.getenv("SCRAPERAPI_SESSION_RANDOM") or "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        if session_fixed:
            params["session_number"] = session_fixed
        elif session_random:
            params["session_number"] = str(random.randint(1, 999999))

    return f"{SCRAPERAPI_BASE}?{urlencode(params)}"


def _looks_blocked(html: str, status: int) -> bool:
    """Check if response indicates blocking or captcha."""
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _captcha_hit_snippet(text: str) -> Optional[str]:
    lowered = (text or "").lower()
    for k in CAPTCHA_KEYWORDS:
        idx = lowered.find(k)
        if idx != -1:
            start = max(0, idx - 60)
            end = min(len(text), idx + len(k) + 60)
            snippet = (text[start:end] or "").replace("\n", " ").replace("\r", " ")
            snippet = re.sub(r"\s+", " ", snippet)
            return f"keyword={k} snippet={snippet}"
    return None


def _build_search_url(location: str, page: int = 0) -> str:
    """
    Build SpareRoom search URL for property listings.

    URL pattern: https://www.spareroom.co.uk/roommate/search.pl?location={encoded_location}&page={page+1}
    Focus on property listing cards with attributes; fall back to generic selectors.
    """
    encoded = quote_plus(location.strip())
    base = "https://www.spareroom.co.uk/flatshare/"
    if page > 0:
        return f"{base}?search_id=&location={encoded}&page={page + 1}"
    return f"{base}?search_id=&location={encoded}"


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
            print(f"ℹ️ Using ScraperAPI for SpareRoom HTML fetch: {url}")
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
            log_fetch_diagnostics(
                "spareroom",
                url,
                status=int(status),
                text=text,
                via="scraperapi" if mode == "scraperapi" else "direct",
            )

            blocked = (
                _looks_blocked(text, status)
                or _has_cloudflare_marker(text)
                or not (text or "").strip()
            )

            hit = _captcha_hit_snippet(text)
            if hit:
                print(f"⚠️ [spareroom] captcha_detected=true {hit}")

            if mode == "scraperapi" and blocked and SCRAPERAPI_KEY:
                premium_url = make_scraperapi_url(
                    url,
                    render=True,
                    premium=True,
                    session_number=str(random.randint(1, 999999)),
                )
                try:
                    premium_req = session.get(premium_url, headers=headers, timeout=75)
                    if inspect.isawaitable(premium_req):
                        premium_req = await premium_req
                    async with premium_req as p_resp:
                        p_text = await p_resp.text()
                        p_status = getattr(p_resp, "status", 0)
                        log_fetch_diagnostics(
                            "spareroom",
                            url,
                            status=int(p_status),
                            text=p_text,
                            via="scraperapi-premium",
                        )
                        premium_blocked = (
                            _looks_blocked(p_text, int(p_status))
                            or _has_cloudflare_marker(p_text)
                            or not (p_text or "").strip()
                        )
                        if not premium_blocked:
                            return p_text
                except Exception:
                    return None

            # If direct mode and we detect blocking, try ScraperAPI as fallback
            if mode == "direct" and blocked and SCRAPERAPI_KEY:
                log_scraperapi_fallback("spareroom", url)
                proxy_url = make_scraperapi_url(url, render=True)
                print(f"ℹ️ Fallback to ScraperAPI for blocked URL: {url}")
                try:
                    proxy_req = session.get(proxy_url, headers=headers, timeout=60)
                    if inspect.isawaitable(proxy_req):
                        proxy_req = await proxy_req

                    async with proxy_req as p_resp:
                        p_text = await p_resp.text()
                        p_status = getattr(p_resp, "status", 0)
                        log_fetch_diagnostics(
                            "spareroom",
                            url,
                            status=int(p_status),
                            text=p_text,
                            via="scraperapi-fallback",
                        )

                        blocked_proxy = (
                            _looks_blocked(p_text, int(p_status))
                            or _has_cloudflare_marker(p_text)
                            or not (p_text or "").strip()
                        )
                        if not blocked_proxy:
                            return p_text

                        premium_url = make_scraperapi_url(
                            url,
                            render=True,
                            premium=True,
                            session_number=str(random.randint(1, 999999)),
                        )
                        premium_req = session.get(premium_url, headers=headers, timeout=75)
                        if inspect.isawaitable(premium_req):
                            premium_req = await premium_req
                        async with premium_req as pp_resp:
                            pp_text = await pp_resp.text()
                            pp_status = getattr(pp_resp, "status", 0)
                            log_fetch_diagnostics(
                                "spareroom",
                                url,
                                status=int(pp_status),
                                text=pp_text,
                                via="scraperapi-premium-fallback",
                            )
                            blocked_premium = (
                                _looks_blocked(pp_text, int(pp_status))
                                or _has_cloudflare_marker(pp_text)
                                or not (pp_text or "").strip()
                            )
                            return None if blocked_premium else pp_text
                except Exception:
                    return None

            # If it still looks blocked, return the HTML anyway so downstream parsing
            # + validation can decide whether there are usable cards. In practice,
            # some responses trip keyword heuristics while still containing listings.
            if blocked:
                return text

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


def _stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _extract_external_id_and_url(card: BeautifulSoup) -> tuple[str, Optional[str]]:
    """Extract external ID + best-effort listing URL.

    Uses stable SHA-256 fallback to avoid run-to-run duplicates.
    """
    data_id = card.get("data-advert-id") or card.get("data-listing-id") or card.get("data-id")
    if data_id:
        return f"sr-{data_id}", None

    link = card.select_one("a[href]")
    href = link.get("href") if link else None

    listing_url = None
    if href and isinstance(href, str):
        if href.startswith("http"):
            listing_url = href
        elif href.startswith("/"):
            listing_url = f"https://www.spareroom.co.uk{href}"
        else:
            listing_url = f"https://www.spareroom.co.uk/{href.lstrip('/')}"

        m = re.search(r"flatshare_id=(\d+)", href)
        if m:
            return f"sr-{m.group(1)}", listing_url
        m2 = re.search(r"(\d{6,})", href)
        if m2:
            return f"sr-{m2.group(1)}", listing_url

    signature = listing_url or card.get_text(" ", strip=True)
    return f"sr-{_stable_id(signature)}", listing_url


async def scrape_spareroom_properties(location: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Scrape SpareRoom properties for a given location.

    Returns list of dicts with keys:
    - external_id, title, description, location, price, bedrooms, bathrooms,
      image_url, image_urls, latitude, longitude, source ("spareroom"), raw_url
    """
    mode = os.getenv("SCRAPER_MODE", "direct").lower()

    log_scrape_start("spareroom", location, mode)
    stats = ScraperStats("spareroom", location)
    results: List[Dict[str, Any]] = []
    seen_ids = set()

    with RunLog.start(
        source="spareroom",
        mode=mode,
        location=location,
        meta={"max_pages": SR_MAX_PAGES},
    ) as runlog:
        try:
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
                            bed_match = re.search(
                                r"(\d+)\s*bed(?:room)?s?", desc_text, re.IGNORECASE
                            )
                            bedrooms = int(bed_match.group(1)) if bed_match else 0

                            # Look for bathroom info (e.g., "2 bathroom" or "2 bath")
                            bath_match = re.search(
                                r"(\d+)\s*bath(?:room)?s?", desc_text, re.IGNORECASE
                            )
                            bathrooms = int(bath_match.group(1)) if bath_match else 0

                            # Extract all images
                            image_urls = _extract_images(card)
                            image_url = image_urls[0] if image_urls else None
                            log_image_extraction("spareroom", title, len(image_urls))

                            # Extract description
                            description = _extract_description(card)

                            # Generate external ID
                            external_id, listing_url = _extract_external_id_and_url(card)

                            # Deduplicate by external_id
                            if external_id in seen_ids:
                                stats.log_duplicate_id(external_id)
                                continue
                            seen_ids.add(external_id)

                            # Enrich with coordinates
                            coords = (
                                await _enrich_coordinates(location_text)
                                if _looks_like_postcode(location_text)
                                else {"latitude": 0.0, "longitude": 0.0}
                            )

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
                                "raw_url": listing_url or url,
                                "listing_url": listing_url,
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
                    await asyncio.sleep(SR_DELAY_MS / 1000.0)

            stats.log_summary()
            print(f"✅ Scraped {len(results)} SpareRoom properties for '{location}'")
            runlog.set_count(len(results))
            return results
        except Exception as e:
            # Let RunLog handle the error in __exit__
            print(f"❌ SpareRoom scraper error: {e}")
            raise
