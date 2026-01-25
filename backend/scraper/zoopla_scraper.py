import asyncio
import hashlib
import inspect
import json
import os
import random
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import aiohttp
from bs4 import BeautifulSoup
from fastapi import BackgroundTasks

from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.render import PLAYWRIGHT_ENABLE, capture_debug_html, render_page
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

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
ZP_MAX_PAGES = int(os.getenv("ZP_MAX_PAGES", "1"))
ZP_DELAY_MS = int(os.getenv("ZP_DELAY_MS", "900"))
SCRAPERAPI_BASE = "https://api.scraperapi.com/"

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic"]


def _has_cloudflare_marker(text: str) -> bool:
    lowered = (text or "").lower()
    # Avoid false positives: many normal pages include Cloudflare analytics/beacons
    # (e.g. static.cloudflareinsights.com). We only treat clear challenge/block pages
    # as Cloudflare-blocked.
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


_SLUG_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def _slugify_location(location: str) -> str:
    s = (location or "").strip().lower()
    if not s:
        return ""
    s = s.replace("'", "").replace("’", "")
    s = _SLUG_NON_ALNUM_RE.sub("-", s)
    s = s.strip("-")
    return s


def _extract_next_data(soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
    """Extract Next.js __NEXT_DATA__ JSON when present."""
    try:
        el = soup.find("script", id="__NEXT_DATA__")
        if not el:
            return None
        raw = el.string or el.get_text() or ""
        raw = raw.strip()
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        return None


_NEXT_DATA_RE = re.compile(
    r"<script[^>]*id=\"__NEXT_DATA__\"[^>]*>(?P<json>.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)


_NEXT_DATA_ASSIGN_RE = re.compile(
    r"(?:window\.|self\.)?__NEXT_DATA__\s*=\s*(?P<json>\{.*?\})\s*;?\s*</script>",
    re.IGNORECASE | re.DOTALL,
)


def _extract_next_data_from_html(html: str) -> Optional[Dict[str, Any]]:
    """Fallback extractor for Next.js __NEXT_DATA__.

    Some proxied/rendered responses can trip up BeautifulSoup's `.string` handling
    or slightly alter script nodes. This regex-based extractor is a best-effort
    fallback when card parsing fails.
    """
    try:
        if not html:
            return None
        m = _NEXT_DATA_RE.search(html)
        if m:
            raw = (m.group("json") or "").strip()
            if raw:
                return json.loads(raw)

        # Some deployments inline-assign the JSON instead of using id=__NEXT_DATA__.
        m2 = _NEXT_DATA_ASSIGN_RE.search(html)
        if not m2:
            return None
        raw2 = (m2.group("json") or "").strip()
        if not raw2:
            return None
        return json.loads(raw2)
    except Exception:
        return None


def _find_zoopla_listings_in_next_data(next_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(next_data, dict):
        return []

    def _looks_like_listing(d: Any) -> bool:
        if not isinstance(d, dict):
            return False
        has_id = any(k in d for k in ("listingId", "listing_id", "id"))
        has_price = "price" in d or "displayPrice" in d
        has_addr = any(k in d for k in ("displayAddress", "address", "title"))
        return bool(has_id and (has_price or has_addr))

    preferred_keys = ("listings", "regularListings", "results", "searchResults", "properties")

    def _scan(obj: Any, depth: int = 0) -> Optional[List[Dict[str, Any]]]:
        if depth > 14:
            return None
        if isinstance(obj, dict):
            for k in preferred_keys:
                v = obj.get(k)
                if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
                    if sum(1 for x in v if _looks_like_listing(x)) >= max(1, len(v) // 4):
                        return v  # type: ignore[return-value]
            for v in obj.values():
                found = _scan(v, depth + 1)
                if found:
                    return found
        elif isinstance(obj, list):
            if obj and all(isinstance(x, dict) for x in obj):
                if sum(1 for x in obj if _looks_like_listing(x)) >= max(1, len(obj) // 4):
                    return obj  # type: ignore[return-value]
            for v in obj:
                found = _scan(v, depth + 1)
                if found:
                    return found
        return None

    found = _scan(next_data)
    return found or []


def _zoopla_property_from_listing_dict(d: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        listing_id = d.get("listingId") or d.get("listing_id") or d.get("id")
        if listing_id is None:
            return None
        external_id = str(listing_id)

        title = (
            d.get("title")
            or d.get("displayAddress")
            or d.get("address")
            or d.get("summary")
            or "Untitled"
        )

        price_val: Any = d.get("price") or d.get("displayPrice")
        price: Optional[int] = None
        if isinstance(price_val, dict):
            price = price_val.get("amount") or price_val.get("value")
        elif isinstance(price_val, (int, float)):
            price = int(price_val)
        elif isinstance(price_val, str):
            price = _parse_price(price_val)

        bedrooms = d.get("bedrooms") or d.get("numBedrooms") or d.get("num_bedrooms") or 0
        bathrooms = d.get("bathrooms") or d.get("numBathrooms") or d.get("num_bathrooms") or 0

        property_type_raw = (
            d.get("propertyType") or d.get("property_type") or d.get("propertySubType")
        )
        property_type = (
            _normalize_property_type(str(property_type_raw)) if property_type_raw else None
        )

        description = d.get("description") or d.get("summary")
        if isinstance(description, str):
            description = description.strip()
            if len(description) < 20:
                description = None
        else:
            description = None

        image_urls: List[str] = []
        for key in ("imageUrls", "image_urls", "images"):
            v = d.get(key)
            if isinstance(v, list):
                for item in v:
                    if isinstance(item, str):
                        image_urls.append(item)
                    elif isinstance(item, dict):
                        url = item.get("url") or item.get("src")
                        if url and isinstance(url, str):
                            image_urls.append(url)
        single_img = d.get("imageUrl") or d.get("image_url")
        if single_img and isinstance(single_img, str):
            image_urls.insert(0, single_img)
        # De-dupe
        seen = set()
        image_urls = [u for u in image_urls if not (u in seen or seen.add(u))]
        image_url = image_urls[0] if image_urls else None

        listing_url = d.get("listingUrl") or d.get("url")
        if not listing_url:
            listing_url = f"https://www.zoopla.co.uk/for-sale/details/{external_id}/"

        loc_text = d.get("displayAddress") or d.get("address") or str(title)
        lat = None
        lng = None
        geo = d.get("location") or d.get("geo") or {}
        if isinstance(geo, dict):
            lat = geo.get("latitude") or geo.get("lat")
            lng = geo.get("longitude") or geo.get("lng")

        return {
            "external_id": external_id,
            "title": str(title).strip(),
            "description": description,
            "location": str(loc_text).strip(),
            "price": price,
            "bedrooms": int(bedrooms) if isinstance(bedrooms, (int, float)) else bedrooms,
            "bathrooms": int(bathrooms) if isinstance(bathrooms, (int, float)) else bathrooms,
            "property_type": property_type,
            "image_url": image_url,
            "image_urls": image_urls,
            "latitude": float(lat) if isinstance(lat, (int, float)) else 0.0,
            "longitude": float(lng) if isinstance(lng, (int, float)) else 0.0,
            "source": "zoopla",
            "raw_url": listing_url,
            "listing_url": listing_url,
        }
    except Exception:
        return None


_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)


def _looks_like_postcode(s: str) -> bool:
    return bool(s and _POSTCODE_RE.search(s))


def make_scraperapi_url(
    target_url: str,
    *,
    render: bool = True,
    premium: bool = False,
    ultra_premium: bool = False,
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
        "ultra_premium": "true" if ultra_premium else None,
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
    if status in (403, 503):
        return True
    lowered = html.lower()
    return any(k in lowered for k in CAPTCHA_KEYWORDS)


def _build_search_url(location: str, page: int = 0) -> str:
    # Zoopla pagination uses ?page=2 etc.
    encoded = _slugify_location(location)
    base = f"https://www.zoopla.co.uk/for-sale/property/{encoded}/"
    if page > 0:
        return f"{base}?page={page + 1}"
    return base


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
            print(f"ℹ️ Using ScraperAPI for Zoopla HTML fetch: {url}")
    else:
        # Direct mode - use original URL
        url_to_fetch = url

    # Fetch the URL (either direct or via ScraperAPI)
    try:
        req = session.get(url_to_fetch, headers=headers, timeout=60 if mode == "scraperapi" else 30)
        if inspect.isawaitable(req):
            req = await req
        async with req as resp:
            text = await resp.text()
            log_fetch_diagnostics(
                "zoopla",
                url,
                status=resp.status,
                text=text,
                via="scraperapi" if mode == "scraperapi" else "direct",
            )

            # ScraperAPI (and occasionally origin) can return 5xx with a small JSON payload.
            # Treat this as actionable fetch failure: log snippet and retry once with premium.
            if 500 <= int(resp.status) <= 599:
                snippet = (text or "").strip().replace("\n", " ").replace("\r", " ")
                snippet = re.sub(r"\s+", " ", snippet)[:300]
                print(
                    f"⚠️ [zoopla] 5xx via={('scraperapi' if mode == 'scraperapi' else 'direct')} status={int(resp.status)} bytes={len(text or '')} snippet={snippet}"
                )

                if SCRAPERAPI_KEY:
                    premium_url = make_scraperapi_url(
                        url,
                        render=True,
                        premium=True,
                        session_number=str(random.randint(1, 999999)),
                    )
                    try:
                        p_req = session.get(premium_url, headers=headers, timeout=75)
                        if inspect.isawaitable(p_req):
                            p_req = await p_req
                        async with p_req as p_resp:
                            p_text = await p_resp.text()
                            log_fetch_diagnostics(
                                "zoopla",
                                url,
                                status=p_resp.status,
                                text=p_text,
                                via="scraperapi-premium-5xx-retry",
                            )
                            if 500 <= int(p_resp.status) <= 599:
                                p_snippet = (
                                    (p_text or "").strip().replace("\n", " ").replace("\r", " ")
                                )
                                p_snippet = re.sub(r"\s+", " ", p_snippet)[:300]
                                print(
                                    f"⚠️ [zoopla] premium 5xx status={int(p_resp.status)} bytes={len(p_text or '')} snippet={p_snippet}"
                                )

                                # ScraperAPI explicitly suggests ultra_premium for some protected domains.
                                if "ultra_premium" in (p_text or "").lower():
                                    ultra_url = make_scraperapi_url(
                                        url,
                                        render=True,
                                        premium=False,
                                        ultra_premium=True,
                                        session_number=str(random.randint(1, 999999)),
                                    )
                                    try:
                                        u_req = session.get(ultra_url, headers=headers, timeout=90)
                                        if inspect.isawaitable(u_req):
                                            u_req = await u_req
                                        async with u_req as u_resp:
                                            u_text = await u_resp.text()
                                            log_fetch_diagnostics(
                                                "zoopla",
                                                url,
                                                status=u_resp.status,
                                                text=u_text,
                                                via="scraperapi-ultra-premium-5xx-retry",
                                            )
                                            if 500 <= int(u_resp.status) <= 599:
                                                return None
                                            ultra_blocked = (
                                                _looks_blocked(u_text, int(u_resp.status))
                                                or _has_cloudflare_marker(u_text)
                                                or not (u_text or "").strip()
                                            )
                                            return None if ultra_blocked else u_text
                                    except Exception:
                                        return None
                                return None

                            premium_blocked = (
                                _looks_blocked(p_text, int(p_resp.status))
                                or _has_cloudflare_marker(p_text)
                                or not (p_text or "").strip()
                            )
                            return None if premium_blocked else p_text
                    except Exception:
                        return None

                return None

            blocked = (
                _looks_blocked(text, resp.status)
                or _has_cloudflare_marker(text)
                or not (text or "").strip()
            )

            # If already using ScraperAPI and we hit Cloudflare/blocked, retry once with premium.
            if mode == "scraperapi" and blocked and SCRAPERAPI_KEY:
                premium_url = make_scraperapi_url(
                    url,
                    render=True,
                    premium=True,
                    session_number=str(random.randint(1, 999999)),
                )
                try:
                    p_req = session.get(premium_url, headers=headers, timeout=75)
                    if inspect.isawaitable(p_req):
                        p_req = await p_req
                    async with p_req as p_resp:
                        p_text = await p_resp.text()
                        log_fetch_diagnostics(
                            "zoopla",
                            url,
                            status=p_resp.status,
                            text=p_text,
                            via="scraperapi-premium",
                        )
                        premium_blocked = (
                            _looks_blocked(p_text, p_resp.status)
                            or _has_cloudflare_marker(p_text)
                            or not (p_text or "").strip()
                        )
                        if not premium_blocked:
                            return p_text
                except Exception:
                    return None

            # If direct mode and we detect blocking, try ScraperAPI as fallback
            if mode == "direct" and blocked and SCRAPERAPI_KEY:
                log_scraperapi_fallback("zoopla", url)
                proxy_url = make_scraperapi_url(url, render=True)
                print(f"ℹ️ Fallback to ScraperAPI for blocked URL: {url}")
                try:
                    p_req = session.get(proxy_url, headers=headers, timeout=60)
                    if inspect.isawaitable(p_req):
                        p_req = await p_req
                    async with p_req as p_resp:
                        p_text = await p_resp.text()
                        log_fetch_diagnostics(
                            "zoopla",
                            url,
                            status=p_resp.status,
                            text=p_text,
                            via="scraperapi-fallback",
                        )
                        blocked_proxy = (
                            _looks_blocked(p_text, p_resp.status)
                            or _has_cloudflare_marker(p_text)
                            or not (p_text or "").strip()
                        )
                        if not blocked_proxy:
                            return p_text

                        # One more attempt: premium + session pinning.
                        premium_url = make_scraperapi_url(
                            url,
                            render=True,
                            premium=True,
                            session_number=str(random.randint(1, 999999)),
                        )
                        pp_req = session.get(premium_url, headers=headers, timeout=75)
                        if inspect.isawaitable(pp_req):
                            pp_req = await pp_req
                        async with pp_req as pp_resp:
                            pp_text = await pp_resp.text()
                            log_fetch_diagnostics(
                                "zoopla",
                                url,
                                status=pp_resp.status,
                                text=pp_text,
                                via="scraperapi-premium-fallback",
                            )
                            blocked_premium = (
                                _looks_blocked(pp_text, pp_resp.status)
                                or _has_cloudflare_marker(pp_text)
                                or not (pp_text or "").strip()
                            )
                            if blocked_premium:
                                return None
                            return pp_text
                except Exception:
                    return None

            # If still looks blocked, return None
            if blocked:
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
                p_req = session.get(proxy_url, headers=headers, timeout=60)
                if inspect.isawaitable(p_req):
                    p_req = await p_req
                async with p_req as p_resp:
                    p_text = await p_resp.text()
                    log_fetch_diagnostics(
                        "zoopla",
                        url,
                        status=p_resp.status,
                        text=p_text,
                        via="scraperapi-exception-fallback",
                    )
                    blocked_proxy = (
                        _looks_blocked(p_text, p_resp.status)
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
                    pp_req = session.get(premium_url, headers=headers, timeout=75)
                    if inspect.isawaitable(pp_req):
                        pp_req = await pp_req
                    async with pp_req as pp_resp:
                        pp_text = await pp_resp.text()
                        log_fetch_diagnostics(
                            "zoopla",
                            url,
                            status=pp_resp.status,
                            text=pp_text,
                            via="scraperapi-premium-exception-fallback",
                        )
                        blocked_premium = (
                            _looks_blocked(pp_text, pp_resp.status)
                            or _has_cloudflare_marker(pp_text)
                            or not (pp_text or "").strip()
                        )
                        return None if blocked_premium else pp_text
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
        card.select_one("[data-testid='property-type']")
        or card.select_one(".listing-property-type")
        or card.select_one(".property-type")
        or card.select_one(".property-information")
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
    if "studio" in lower:
        return "studio"
    if "flat" in lower or "apartment" in lower:
        return "flat"
    if "detached" in lower and "semi" not in lower:
        return "detached"
    if "semi-detached" in lower or "semi detached" in lower:
        return "semi-detached"
    if "terraced" in lower:
        return "terraced"
    if "bungalow" in lower:
        return "bungalow"
    if "house" in lower:
        return "house"
    if "maisonette" in lower:
        return "maisonette"
    if "cottage" in lower:
        return "cottage"

    return None


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
                    url = "https://www.zoopla.co.uk" + url
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
                            url = "https://www.zoopla.co.uk" + url
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
        card.select_one("[data-testid='listing-description']")
        or card.select_one(".listing-description")
        or card.select_one(".property-description")
        or card.select_one("[itemprop='description']")
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


def _stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _extract_external_id_and_url(card: BeautifulSoup) -> tuple[str, Optional[str]]:
    link = card.select_one("a[href*='/for-sale/details/']")
    href = link.get("href") if link else None

    listing_url = None
    if href and isinstance(href, str):
        listing_url = href if href.startswith("http") else f"https://www.zoopla.co.uk{href}"
        m = re.search(r"/for-sale/details/(\d+)", href)
        if m:
            # IMPORTANT: Keep Zoopla external_id numeric to match historical runs.
            # The DB upsert uses on_conflict="source,external_id"; adding a prefix
            # (e.g., "zp-") would break matching and create duplicates.
            return m.group(1), listing_url

    # Stable fallback (URL if we have it, otherwise text signature)
    signature = listing_url or card.get_text(" ", strip=True)
    # Only used when Zoopla doesn't expose a numeric listing id.
    return f"zp-hash-{_stable_id(signature)}", listing_url


async def scrape_zoopla_properties(
    location: str, limit: int = 40, background_tasks: BackgroundTasks | None = None
) -> List[Dict[str, Any]]:
    log_scrape_start("zoopla", location, SCRAPER_MODE)
    stats = ScraperStats("zoopla", location)
    results: List[Dict[str, Any]] = []

    # Start audit logging
    with RunLog.start(source="zoopla", mode=SCRAPER_MODE, location=location) as run_log:
        try:
            async with aiohttp.ClientSession() as session:
                for page in range(ZP_MAX_PAGES):
                    url = _build_search_url(location, page)
                    html = await _fetch_html(session, url)
                    if not html:
                        # If direct fetch gets blocked/empty, try browser rendering if enabled.
                        if PLAYWRIGHT_ENABLE:
                            rendered = await render_page(
                                url,
                                [
                                    "[data-testid='search-result']",
                                    ".c-propertyCard",
                                    ".l-searchResult",
                                ],
                            )
                            if rendered:
                                html = rendered
                            else:
                                log_page_fetch_error("zoopla", page, "blocked or empty")
                                continue
                        else:
                            log_page_fetch_error("zoopla", page, "blocked or empty")
                            continue
                    soup = BeautifulSoup(html, "html.parser")
                    cards = _collect_cards(soup)
                    if not cards:
                        next_data = _extract_next_data(soup) or _extract_next_data_from_html(html)
                        embedded_listings = (
                            _find_zoopla_listings_in_next_data(next_data) if next_data else []
                        )
                        if embedded_listings:
                            for d in embedded_listings:
                                if len(results) >= limit:
                                    break
                                mapped = _zoopla_property_from_listing_dict(d)
                                if not mapped:
                                    continue
                                should_insert, reason = should_insert_property(mapped)
                                if should_insert:
                                    results.append(clean_property_data(mapped))
                                    stats.log_parse_success()
                                else:
                                    stats.log_validation_failure(reason or "Unknown")

                            if results:
                                stats.log_summary()
                                print(
                                    f"✅ Zoopla embedded JSON returned {len(results)} properties for '{location}'"
                                )
                                run_log.set_count(len(results))
                                return results

                        if PLAYWRIGHT_ENABLE:
                            rendered = await render_page(
                                url,
                                [
                                    "[data-testid='search-result']",
                                    ".c-propertyCard",
                                    ".l-searchResult",
                                ],
                            )
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

                            external_id, listing_url = _extract_external_id_and_url(card)
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
                                "property_type": property_type,
                                "image_url": image_url,
                                "image_urls": image_urls,
                                "latitude": coords["latitude"],
                                "longitude": coords["longitude"],
                                "source": "zoopla",
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
                    await asyncio.sleep(ZP_DELAY_MS / 1000.0)

            stats.log_summary()
            print(f"✅ Scraped {len(results)} Zoopla properties for '{location}'")
            run_log.set_count(len(results))
            return results
        except Exception as e:
            # Let RunLog handle the error in __exit__
            print(f"❌ Zoopla scraper error: {e}")
            raise


# Backward-compatible stub signature
async def scrape_zoopla_properties_default(background_tasks: BackgroundTasks | None = None):
    return await scrape_zoopla_properties(location="London", background_tasks=background_tasks)
