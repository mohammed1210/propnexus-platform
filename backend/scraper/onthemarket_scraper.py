from __future__ import annotations

import asyncio
import hashlib
import inspect
import os
import random
import re
from html import unescape
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from urllib.parse import quote_plus, urlencode, urljoin, urlparse

try:
    import aiohttp
except ModuleNotFoundError:
    aiohttp = None

if TYPE_CHECKING:
    import aiohttp as aiohttp_types

from bs4 import BeautifulSoup

from backend.scraper.utils import detect_blocked_or_partial_explain, normalize_image_urls
from backend.utils.image_utils import (
    dedupe_image_urls,
    extract_image_urls_from_next_data,
    extract_next_data_json,
    pick_cover_image,
)
from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.render import (
    PLAYWRIGHT_ENABLE,
    capture_debug_json,
    render_page,
    render_page_capture,
)
from backend.utils.retry import retry_async
from backend.utils.runlog import RunLog
from backend.utils.scraper_logger import (
    ScraperStats,
    log_fetch_diagnostics,
    log_page_fetch_error,
    log_scrape_start,
    log_scraperapi_fallback,
)
from backend.utils.validation import clean_property_data, should_insert_property

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

# Bump this when listing/detail selectors materially change.
SELECTOR_VERSION = "v1"


class OnTheMarketBlockedError(RuntimeError):
    """Raised when OnTheMarket appears blocked after all fallbacks."""


def _has_listing_signals(html: str) -> bool:
    lowered = (html or "").lower()
    return any(
        m in lowered
        for m in (
            "/details/",
            "property-card",
            'data-testid="property-card"',
            "otm-propertycard",
        )
    )


_OTM_DATALAYER_IDS_PATTERNS = (
    r"\"property-ids\"\s*:\s*\[(?P<body>[^\]]{0,200000})\]",
    r"\"property_ids\"\s*:\s*\[(?P<body>[^\]]{0,200000})\]",
    r"\"propertyIds\"\s*:\s*\[(?P<body>[^\]]{0,200000})\]",
)


def _extract_otm_property_ids_from_datalayer(html: str) -> set[str]:
    """Best-effort extraction of OTM property IDs from window.dataLayer pushes.

    We intentionally keep this lightweight (regex-only) to avoid JS parsing.
    """

    if not html or not isinstance(html, str):
        return set()

    ids: set[str] = set()
    s = html
    for pat in _OTM_DATALAYER_IDS_PATTERNS:
        for m in re.finditer(pat, s, flags=re.IGNORECASE | re.DOTALL):
            body = (m.group("body") or "").strip()
            if not body:
                continue
            for n in re.findall(r"\b\d{5,}\b", body):
                ids.add(n)
    return ids


def _count_otm_detail_links_in_html(html: str) -> int:
    if not html or not isinstance(html, str):
        return 0
    # Prefer actual href patterns (not just string contains) to reduce false positives.
    return len(
        re.findall(
            r"href=(?:\"[^\"]*?/details/\d+/?\"|'[^']*?/details/\d+/?')",
            html,
            flags=re.IGNORECASE,
        )
    )


def _blocked_by_heuristics_explain(html: str, status: int | None) -> tuple[bool, str | None]:
    s = html or ""
    st = int(status or 0)
    if _looks_blocked(s, st) or _has_cloudflare_marker(s) or not s.strip():
        return True, "blocked_marker"

    reason, meta = detect_blocked_or_partial_explain(
        s, st if st > 0 else None, min_html_bytes=8_000
    )
    if reason is None:
        return False, None

    # OTM listing pages sometimes contain generic strings like "blocked" while still
    # embedding real listing signals (detail links and/or dataLayer property ids).
    if reason == "block_keyword":
        detail_links = _count_otm_detail_links_in_html(s)
        property_ids = len(_extract_otm_property_ids_from_datalayer(s))
        if detail_links > 0 or property_ids > 0 or _has_listing_signals(s):
            kw = meta.get("block_keyword")
            return False, f"block_keyword_ignored:{kw}" if kw else "block_keyword_ignored"
        kw = meta.get("block_keyword")
        return True, f"block_keyword:{kw}" if kw else "block_keyword"

    return True, reason


def _blocked_by_heuristics(html: str, status: int | None) -> bool:
    blocked, _ = _blocked_by_heuristics_explain(html, status)
    return bool(blocked)


# Rotate user agents for OTM only. Keep small list to reduce maintenance.
_USER_AGENT_POOL = [
    USER_AGENT,
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
]

_ACCEPT_LANGUAGE_POOL = [
    "en-GB,en;q=0.9",
    "en-GB,en;q=0.9,fr;q=0.6",
    "en-US,en;q=0.9,en-GB;q=0.8",
]

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


def _slugify_location(location: str) -> str:
    s = (location or "").strip().lower()
    # Keep alphanumerics, spaces, and hyphens; convert whitespace to hyphens.
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _has_cloudflare_marker(text: str) -> bool:
    lowered = (text or "").lower()
    # Avoid false positives from Cloudflare analytics/beacons.
    # Many normal pages include Cloudflare beacons; only treat explicit challenge paths as blocked.
    if "/cdn-cgi/" in lowered:
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


_DETAIL_ID_RE = re.compile(r"/details/(?P<id>\d+)")


def _extract_external_id_from_detail_url(url: str) -> Optional[str]:
    if not url or not isinstance(url, str):
        return None
    m = _DETAIL_ID_RE.search(url)
    return m.group("id") if m else None


def _pick_best_from_srcset(srcset: str) -> Optional[str]:
    if not srcset or not isinstance(srcset, str):
        return None
    best_url: Optional[str] = None
    best_w = -1
    for item in srcset.split(","):
        parts = item.strip().split()
        if not parts:
            continue
        u = parts[0].strip()
        w = 0
        if len(parts) > 1 and parts[1].endswith("w"):
            try:
                w = int(parts[1][:-1])
            except Exception:
                w = 0
        if u and w >= best_w:
            best_w = w
            best_url = u
    return best_url


def _is_otm_listing_photo_url(u: str) -> bool:
    if not u or not isinstance(u, str):
        return False
    try:
        p = urlparse(u)
    except Exception:
        return False
    if p.scheme not in ("http", "https"):
        return False

    host = (p.netloc or "").lower()
    path = (p.path or "").lower()

    # Drop common non-photo assets that frequently appear in the DOM.
    if host.endswith("onthemarket.com") and (
        path.startswith("/assets/")
        or "/images/icons/" in path
        or path.endswith("vidbg.png")
        or path.endswith("floorplanbg.png")
        or "map-pill" in path
    ):
        return False

    # Prefer the dedicated media host for listing imagery.
    if host == "media.onthemarket.com":
        return True

    return False


def _extract_otm_gallery_image_urls(html: str, page_url: str) -> List[str]:
    """Extract gallery images from an OnTheMarket detail page."""
    if not html:
        return []

    soup = BeautifulSoup(html or "", "html.parser")
    candidates: List[str] = []

    # 1) JSON-LD often includes an image array.
    try:
        for el in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = (el.string or el.get_text() or "").strip()
            if not raw:
                continue
            try:
                data = __import__("json").loads(raw)
            except Exception:
                continue

            def _scan(obj: Any, depth: int = 0) -> None:
                if depth > 10:
                    return
                if isinstance(obj, str):
                    s = obj.strip()
                    if s:
                        candidates.append(urljoin(page_url, s))
                    return
                if isinstance(obj, list):
                    for v in obj:
                        _scan(v, depth + 1)
                    return
                if isinstance(obj, dict):
                    if "image" in obj:
                        _scan(obj.get("image"), depth + 1)
                    for v in obj.values():
                        _scan(v, depth + 1)

            _scan(data)
    except Exception:
        pass

    # 2) Common gallery/carousel containers.
    try:
        for el in soup.select(
            "[class*='gallery'] img, [class*='carousel'] img, [data-testid*='gallery'] img"
        ):
            u = (
                el.get("data-src")
                or el.get("data-lazy-src")
                or el.get("data-original")
                or el.get("src")
            )
            if isinstance(u, str) and u.strip():
                candidates.append(urljoin(page_url, u.strip()))
            srcset = el.get("srcset")
            if isinstance(srcset, str) and srcset.strip():
                best = _pick_best_from_srcset(srcset)
                if best:
                    candidates.append(urljoin(page_url, best))
    except Exception:
        pass

    # 3) Responsive picture sources tend to include the large images.
    try:
        for el in soup.select("source[srcset], img[srcset]"):
            srcset = el.get("srcset")
            if isinstance(srcset, str) and srcset.strip():
                best = _pick_best_from_srcset(srcset)
                if best:
                    candidates.append(urljoin(page_url, best))
    except Exception:
        pass

    # 4) Keep og:image as a fallback.
    try:
        og_img = soup.find("meta", attrs={"property": "og:image"})
        if og_img and og_img.get("content"):
            candidates.append(urljoin(page_url, str(og_img.get("content")).strip()))
    except Exception:
        pass

    # 5) Next.js payload scan (when present).
    try:
        next_data = extract_next_data_json(html)
        if isinstance(next_data, dict):
            candidates.extend(extract_image_urls_from_next_data(next_data, base_url=page_url))
    except Exception:
        pass

    normalized = normalize_image_urls(candidates)
    try:
        normalized = dedupe_image_urls(normalized, base_url=page_url)
    except Exception:
        pass
    filtered = [u for u in normalized if _is_otm_listing_photo_url(u)]
    return filtered or normalized


def _collect_detail_listing_urls(soup: BeautifulSoup) -> List[str]:
    urls: List[str] = []
    seen: set[str] = set()
    for a in soup.select("a[href*='/details/']"):
        href = a.get("href")
        if not href or not isinstance(href, str):
            continue
        u = href
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            u = "https://www.onthemarket.com" + u
        if not u.startswith("http"):
            continue
        if not _extract_external_id_from_detail_url(u):
            continue
        if u not in seen:
            seen.add(u)
            urls.append(u)
    return urls


def _parse_otm_detail_page(
    html: str, url: str, *, fallback_location: str
) -> Optional[Dict[str, Any]]:
    external_id = _extract_external_id_from_detail_url(url)
    if not external_id:
        return None

    soup = BeautifulSoup(html or "", "html.parser")

    title = None
    try:
        og_title = soup.find("meta", attrs={"property": "og:title"})
        if og_title and og_title.get("content"):
            title = str(og_title.get("content")).strip() or None
    except Exception:
        title = None
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True) or None
    if title:
        title = unescape(title).strip() or None

    price = None
    if title:
        m = re.search(r"£\s*\d[\d,]*", title)
        if m:
            price = _parse_price(m.group(0))
    if price is None:
        try:
            og_desc = soup.find("meta", attrs={"property": "og:description"})
            if og_desc and og_desc.get("content"):
                price = _parse_price(str(og_desc.get("content")))
        except Exception:
            pass

    # Parse structured data when present (JSON-LD / Next.js) to fill address/geo/beds.
    address: str | None = None
    postcode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    property_type: str | None = None

    def _deep_find_first(obj: Any, keys: tuple[str, ...], depth: int = 0) -> Any:
        if depth > 12:
            return None
        if isinstance(obj, dict):
            for k, v in obj.items():
                if str(k) in keys:
                    return v
            for v in obj.values():
                found = _deep_find_first(v, keys, depth + 1)
                if found is not None:
                    return found
        elif isinstance(obj, list):
            for v in obj:
                found = _deep_find_first(v, keys, depth + 1)
                if found is not None:
                    return found
        return None

    try:
        # JSON-LD can be a list or dict.
        for script in soup.find_all(
            "script", attrs={"type": re.compile("application/ld\\+json", re.I)}
        ):
            raw = script.get_text(" ", strip=True)
            if not raw:
                continue
            try:
                import json

                data = json.loads(raw)
            except Exception:
                continue
            candidates = data if isinstance(data, list) else [data]
            for c in candidates:
                if not isinstance(c, dict):
                    continue
                addr = c.get("address")
                if isinstance(addr, str) and addr.strip():
                    address = address or addr.strip()
                elif isinstance(addr, dict):
                    parts = [
                        addr.get("streetAddress"),
                        addr.get("addressLocality"),
                        addr.get("addressRegion"),
                        addr.get("postalCode"),
                    ]
                    parts_s = [
                        str(p).strip()
                        for p in parts
                        if isinstance(p, (str, int)) and str(p).strip()
                    ]
                    if parts_s:
                        address = address or ", ".join(parts_s)
                    pc = addr.get("postalCode")
                    if pc and isinstance(pc, str):
                        postcode = postcode or pc.strip()

                geo = c.get("geo")
                if isinstance(geo, dict):
                    lat = geo.get("latitude")
                    lng = geo.get("longitude")
                    try:
                        if latitude is None and lat is not None:
                            latitude = float(lat)
                        if longitude is None and lng is not None:
                            longitude = float(lng)
                    except Exception:
                        pass

                # Beds/baths hints
                for k in ("numberOfBedrooms", "bedrooms", "numBedrooms", "numberOfRooms"):
                    if bedrooms is None and k in c:
                        try:
                            bedrooms = int(float(c.get(k)))
                        except Exception:
                            pass
                for k in ("numberOfBathroomsTotal", "bathrooms", "numBathrooms"):
                    if bathrooms is None and k in c:
                        try:
                            bathrooms = int(float(c.get(k)))
                        except Exception:
                            pass

                pt = c.get("@type")
                if property_type is None and isinstance(pt, str) and pt.strip():
                    property_type = pt.strip()
    except Exception:
        pass

    try:
        next_data = extract_next_data_json(html)
        if isinstance(next_data, dict):
            if bedrooms is None:
                v = _deep_find_first(next_data, ("bedrooms", "numBedrooms", "numberOfBedrooms"))
                try:
                    bedrooms = int(float(v)) if v is not None else bedrooms
                except Exception:
                    pass
            if bathrooms is None:
                v = _deep_find_first(next_data, ("bathrooms", "numBathrooms", "numberOfBathrooms"))
                try:
                    bathrooms = int(float(v)) if v is not None else bathrooms
                except Exception:
                    pass
            if property_type is None:
                v = _deep_find_first(next_data, ("propertyType", "property_type", "type"))
                if isinstance(v, str) and v.strip():
                    property_type = v.strip()
            if postcode is None:
                v = _deep_find_first(next_data, ("postalCode", "postcode", "postCode"))
                if isinstance(v, str) and v.strip():
                    postcode = v.strip()
            if latitude is None:
                v = _deep_find_first(next_data, ("latitude", "lat"))
                try:
                    latitude = float(v) if v is not None else latitude
                except Exception:
                    pass
            if longitude is None:
                v = _deep_find_first(next_data, ("longitude", "lng", "lon"))
                try:
                    longitude = float(v) if v is not None else longitude
                except Exception:
                    pass
    except Exception:
        pass

    # Fallback property type from title text.
    if property_type is None and title:
        tl = title.lower()
        for cand in (
            "detached",
            "semi-detached",
            "terraced",
            "bungalow",
            "flat",
            "apartment",
            "maisonette",
            "studio",
        ):
            if cand in tl:
                property_type = cand
                break

    # Prefer a human-readable address/location when available.
    location = address or fallback_location
    if not postcode and location and isinstance(location, str):
        try:
            from backend.utils.listing_keys import extract_postcode

            postcode = extract_postcode(location) or extract_postcode(title or "")
        except Exception:
            postcode = None

    image_urls: List[str] = []
    try:
        # Preload image hints
        for link in soup.find_all("link", attrs={"rel": "preload"}):
            if (link.get("as") or "").lower() != "image":
                continue
            href = link.get("href")
            if href and isinstance(href, str):
                image_urls.append(urljoin(url, href.strip()))
    except Exception:
        pass

    # Detail-page gallery (preferred)
    try:
        image_urls.extend(_extract_otm_gallery_image_urls(html, url))
    except Exception:
        pass

    image_urls = normalize_image_urls([urljoin(url, u) for u in image_urls if isinstance(u, str)])
    filtered_urls = [u for u in image_urls if _is_otm_listing_photo_url(u)]
    image_urls = filtered_urls or image_urls
    try:
        image_urls = dedupe_image_urls(image_urls, base_url=url)
    except Exception:
        pass
    image_url = pick_cover_image(image_urls) if image_urls else None

    return {
        "external_id": f"ot-{external_id}",
        "title": title or f"OnTheMarket listing {external_id}",
        "location": location,
        "address": address,
        "postcode": postcode,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_type": property_type,
        "image_url": image_url,
        "image_urls": image_urls,
        "imageurl": image_url,
        "latitude": latitude,
        "longitude": longitude,
        "source": "onthemarket",
        "raw_url": url,
        "listing_url": url,
    }


SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
OT_MAX_PAGES = int(os.getenv("OT_MAX_PAGES", "1"))
OT_DELAY_MS = int(os.getenv("OT_DELAY_MS", "900"))  # delay between pages (ms)

# OTM-only request pacing. Keep modest by default.
OTM_MIN_REQUEST_DELAY_MS = int(os.getenv("OTM_MIN_REQUEST_DELAY_MS", "250"))
OTM_MAX_REQUEST_DELAY_MS = int(os.getenv("OTM_MAX_REQUEST_DELAY_MS", "900"))
OTM_ROTATE_HEADERS = (os.getenv("OTM_ROTATE_HEADERS", "1") or "1").strip().lower() in (
    "1",
    "true",
    "yes",
)

SCRAPERAPI_BASE = "https://api.scraperapi.com/"


def _otm_headers() -> Dict[str, str]:
    ua = USER_AGENT
    lang = "en-GB,en;q=0.9"
    if OTM_ROTATE_HEADERS:
        ua = random.choice(_USER_AGENT_POOL)
        lang = random.choice(_ACCEPT_LANGUAGE_POOL)

    # Keep headers minimal; ScraperAPI keep_headers=true forwards them.
    return {
        "User-Agent": ua,
        "Accept-Language": lang,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://www.onthemarket.com/",
        "DNT": "1",
    }


async def _otm_request_jitter() -> None:
    lo = max(0, int(OTM_MIN_REQUEST_DELAY_MS))
    hi = max(lo, int(OTM_MAX_REQUEST_DELAY_MS))
    if hi <= 0:
        return
    await asyncio.sleep(random.uniform(lo, hi) / 1000.0)


def make_scraperapi_url(
    target_url: str,
    *,
    render: bool = True,
    premium: bool = False,
    keep_headers: bool = True,
    country_code: str | None = "gb",
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

    params: Dict[str, str | None] = {
        "api_key": api_key,
        "render": "true" if render else None,
        "country_code": country_code,
        "keep_headers": "true" if keep_headers else None,
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
    lowered = (html or "").lower()

    strong_markers = [
        *CAPTCHA_KEYWORDS,
        "robot check",
        "blocked",
        "datadome",
        "incapsula",
        "access denied",
    ]

    # Explicit human-challenge signals should always count as blocked.
    if any(k in lowered for k in strong_markers):
        return True

    # Status-based blocks: be conservative (treat as blocked if the body looks empty/challenge-like).
    if int(status) in (403, 429, 503):
        if _has_cloudflare_marker(lowered):
            return True
        if not (html or "").strip():
            return True
        if len(lowered) < 1500:
            return True
        if "onthemarket" not in lowered:
            return True
        return False

    return False


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
    Build OnTheMarket search URL for property listings.

    URL pattern: https://www.onthemarket.com/for-sale/property/{encoded_location}/?view=grid&page={page+1}
    Note: If markup changes, scraper may yield 0 results; logging will warn.
    """
    slug = _slugify_location(location)
    encoded = quote_plus(slug)
    base = f"https://www.onthemarket.com/for-sale/property/{encoded}/"
    if page > 0:
        return f"{base}?view=grid&page={page + 1}"
    return f"{base}?view=grid"


async def _fetch_html_internal(session: "aiohttp_types.ClientSession", url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    # Determine which URL to fetch based on SCRAPER_MODE
    mode = os.getenv("SCRAPER_MODE", "direct").lower()

    def _truthy_env(name: str, default: str = "0") -> bool:
        v = (os.getenv(name, default) or default).strip().lower()
        return v in ("1", "true", "yes", "y", "on")

    def _basic_attempts() -> List[Dict[str, Any]]:
        if mode == "scraperapi":
            if not SCRAPERAPI_KEY:
                print(
                    "⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set, falling back to direct fetch"
                )
                return [{"via": "direct", "url": url, "timeout": 30}]
            print(f"ℹ️ Using ScraperAPI (basic) for OnTheMarket HTML fetch: {url}")
            return [
                {
                    "via": "scraperapi-basic",
                    "url": make_scraperapi_url(url, render=True, premium=False, keep_headers=True),
                    "timeout": 60,
                }
            ]

        # direct mode
        attempts: List[Dict[str, Any]] = [{"via": "direct", "url": url, "timeout": 30}]
        if SCRAPERAPI_KEY:
            attempts.append(
                {
                    "via": "scraperapi-basic-fallback",
                    "url": make_scraperapi_url(url, render=True, premium=False, keep_headers=True),
                    "timeout": 60,
                }
            )
        return attempts

    def _strong_attempts() -> List[Dict[str, Any]]:
        if not SCRAPERAPI_KEY:
            return []
        # Only used when we detect blocking.
        return [
            {
                "via": "scraperapi-render-premium",
                "url": make_scraperapi_url(
                    url,
                    render=True,
                    premium=True,
                    keep_headers=True,
                    session_number=str(random.randint(1, 999999)),
                ),
                "timeout": 80,
            },
            # Some sites behave better when ScraperAPI does not forward headers.
            {
                "via": "scraperapi-render-premium-noheaders",
                "url": make_scraperapi_url(
                    url,
                    render=True,
                    premium=True,
                    keep_headers=False,
                    session_number=str(random.randint(1, 999999)),
                ),
                "timeout": 90,
            },
            {
                "via": "scraperapi-render-noheaders",
                "url": make_scraperapi_url(
                    url,
                    render=True,
                    premium=False,
                    keep_headers=False,
                    session_number=str(random.randint(1, 999999)),
                ),
                "timeout": 90,
            },
        ]

    last_text: Optional[str] = None
    last_status: int | None = None
    saw_blocked = False
    try:
        # Optional: force Playwright as the primary strategy for OTM.
        # ScraperAPI/direct remain as fallbacks if Playwright fails or looks blocked.
        otm_force_playwright = _truthy_env("OTM_FORCE_PLAYWRIGHT", "0")
        if otm_force_playwright and PLAYWRIGHT_ENABLE:
            try:
                rendered = await render_page(
                    url,
                    selectors=[
                        "a[href*='/details/']",
                        ".property-card",
                        "[data-testid='property-card']",
                    ],
                    click_selectors=[
                        "#ccc-recommended-settings",
                        "#ccc-accept-settings",
                        "button:has-text('Accept')",
                        "button:has-text('I agree')",
                    ],
                )
            except Exception:
                rendered = None

            if rendered:
                last_text = rendered
                last_status = 200
                blocked = _blocked_by_heuristics(rendered, 200)
                saw_blocked = saw_blocked or bool(blocked)
                log_fetch_diagnostics(
                    "onthemarket",
                    url,
                    status=200,
                    text=rendered,
                    via="playwright-primary",
                )
                if (not blocked) and _has_listing_signals(rendered):
                    return rendered

        attempts = _basic_attempts()
        for idx, attempt in enumerate(attempts):
            via = str(attempt.get("via") or "")
            url_to_fetch = str(attempt.get("url") or url)
            timeout_value = int(attempt.get("timeout") or (60 if mode == "scraperapi" else 30))
            headers = _otm_headers()

            # In direct mode, only log ScraperAPI fallback when we believe we were blocked.
            if idx > 0 and mode == "direct" and via.startswith("scraperapi"):
                log_scraperapi_fallback("onthemarket", url)

            await _otm_request_jitter()
            req = session.get(url_to_fetch, headers=headers, timeout=timeout_value)

            # If tests mock session.get as AsyncMock, req is awaitable.
            if inspect.isawaitable(req):
                req = await req

            async with req as resp:
                text = await resp.text()
                status = getattr(resp, "status", 0)
                last_text = text
                last_status = int(status or 0)
                log_fetch_diagnostics(
                    "onthemarket",
                    url,
                    status=int(status),
                    text=text,
                    via=via or ("scraperapi" if mode == "scraperapi" else "direct"),
                )

                blocked, blocked_reason = _blocked_by_heuristics_explain(text, int(status))
                saw_blocked = saw_blocked or bool(blocked)

                if blocked_reason and blocked_reason.startswith("block_keyword"):
                    kw = None
                    try:
                        if ":" in blocked_reason:
                            kw = blocked_reason.split(":", 1)[1].strip() or None
                    except Exception:
                        kw = None
                    if kw:
                        print(
                            f"ℹ️ [onthemarket] blocked_meta.keyword={kw} reason={blocked_reason.split(':',1)[0]}"
                        )
                    else:
                        print(
                            f"ℹ️ [onthemarket] blocked_meta.keyword=<none> reason={blocked_reason}"
                        )

                hit = _captcha_hit_snippet(text)
                if hit:
                    print(f"⚠️ [onthemarket] captcha_detected=true {hit}")

                if not blocked:
                    return text

        # If basic path was blocked, escalate (costly) modes.
        if saw_blocked:
            for attempt in _strong_attempts():
                via = str(attempt.get("via") or "")
                url_to_fetch = str(attempt.get("url") or url)
                timeout_value = int(attempt.get("timeout") or 90)
                headers = _otm_headers()

                await _otm_request_jitter()
                req = session.get(url_to_fetch, headers=headers, timeout=timeout_value)
                if inspect.isawaitable(req):
                    req = await req

                async with req as resp:
                    text = await resp.text()
                    status = getattr(resp, "status", 0)
                    last_text = text
                    last_status = int(status or 0)
                    log_fetch_diagnostics(
                        "onthemarket",
                        url,
                        status=int(status),
                        text=text,
                        via=via,
                    )

                    blocked, blocked_reason = _blocked_by_heuristics_explain(text, int(status))
                    if blocked_reason and blocked_reason.startswith("block_keyword"):
                        kw = None
                        try:
                            if ":" in blocked_reason:
                                kw = blocked_reason.split(":", 1)[1].strip() or None
                        except Exception:
                            kw = None
                        if kw:
                            print(
                                f"ℹ️ [onthemarket] blocked_meta.keyword={kw} reason={blocked_reason.split(':',1)[0]}"
                            )
                        else:
                            print(
                                f"ℹ️ [onthemarket] blocked_meta.keyword=<none> reason={blocked_reason}"
                            )
                    if not blocked:
                        return text

        # Playwright fallback (only if we actually looked blocked).
        # Controlled by env to manage costs/complexity in production.
        otm_pw_fallback = _truthy_env("OTM_PLAYWRIGHT_FALLBACK", "1")
        if saw_blocked and PLAYWRIGHT_ENABLE and otm_pw_fallback:
            try:
                rendered = await render_page(
                    url,
                    selectors=[
                        "a[href*='/details/']",
                        ".property-card",
                        "[data-testid='property-card']",
                    ],
                    click_selectors=[
                        "#ccc-recommended-settings",
                        "#ccc-accept-settings",
                        "button:has-text('Accept')",
                        "button:has-text('I agree')",
                    ],
                )
            except Exception:
                rendered = None

            if (
                rendered
                and (not _blocked_by_heuristics(rendered, 200))
                and _has_listing_signals(rendered)
            ):
                log_fetch_diagnostics(
                    "onthemarket",
                    url,
                    status=200,
                    text=rendered,
                    via="playwright-fallback",
                )
                return rendered

        # If it still looks blocked after escalation, surface it clearly.
        if saw_blocked and _blocked_by_heuristics(last_text or "", last_status or 0):
            raise OnTheMarketBlockedError("onthemarket blocked")

        return last_text
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
                proxy_req = session.get(proxy_url, headers=_otm_headers(), timeout=60)
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


async def _fetch_html(session: "aiohttp_types.ClientSession", url: str) -> Optional[str]:
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


async def _enrich_coordinates(location: str) -> Dict[str, float | None]:
    """Get coordinates from postcode, best-effort."""
    try:
        coords = await get_lat_lng_from_postcode(location, use_db_cache=True)
        if not coords:
            return {"latitude": None, "longitude": None}

        lat = coords.get("latitude")
        lng = coords.get("longitude")
        if lat is None or lng is None:
            return {"latitude": None, "longitude": None}
        lat_f = float(lat)
        lng_f = float(lng)
        if lat_f == 0.0 or lng_f == 0.0:
            return {"latitude": None, "longitude": None}

        return {"latitude": lat_f, "longitude": lng_f}
    except Exception:
        return {"latitude": None, "longitude": None}


def _stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _extract_external_id_and_url(
    card: BeautifulSoup, title: str, location: str
) -> tuple[str, Optional[str]]:
    """Extract external ID + best-effort listing URL.

    Uses stable SHA-256 fallback to avoid run-to-run duplicates.
    """
    data_id = card.get("data-id")
    if data_id:
        return f"ot-{data_id}", None

    link = card.select_one("a[href*='/details/']")
    href = link.get("href") if link else None

    listing_url = None
    if href and isinstance(href, str):
        listing_url = href if href.startswith("http") else f"https://www.onthemarket.com{href}"
        m = re.search(r"/details/(\d+)", href)
        if m:
            return f"ot-{m.group(1)}", listing_url

    signature = listing_url or f"{title}|{location}"
    return f"ot-{_stable_id(signature)}", listing_url


async def scrape_onthemarket_properties(
    location: str, limit: int = 50, *, max_pages: int | None = None
) -> List[Dict[str, Any]]:
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

    effective_max_pages = (
        int(max_pages)
        if max_pages is not None
        else int(os.getenv("OT_MAX_PAGES", str(OT_MAX_PAGES)))
    )
    effective_max_pages = max(1, min(5, int(effective_max_pages)))

    with RunLog.start(
        source="onthemarket",
        mode=mode,
        location=location,
        meta={"max_pages": effective_max_pages},
    ) as runlog:
        try:
            async with aiohttp.ClientSession() as session:
                # Collect detail URLs from listing pages; detail pages are the canonical source.
                collected_detail_urls: List[str] = []
                collected_seen: set[str] = set()

                default_max_detail_urls = max(40, int(limit or 0) * 4)
                effective_max_detail_urls = int(
                    os.getenv("OTM_MAX_DETAIL_URLS", str(default_max_detail_urls))
                )
                effective_max_detail_urls = max(
                    int(limit or 1), min(300, effective_max_detail_urls)
                )

                detail_concurrency = int(os.getenv("OTM_DETAIL_CONCURRENCY", "4"))
                detail_concurrency = max(1, min(8, detail_concurrency))
                sem = asyncio.Semaphore(detail_concurrency)

                async def _fetch_parse_one(detail_url: str) -> Optional[Dict[str, Any]]:
                    async with sem:
                        try:
                            detail_html = await _fetch_html(session, detail_url)
                        except OnTheMarketBlockedError:
                            detail_html = None
                        except Exception:
                            detail_html = None

                        if not detail_html or not (detail_html or "").strip():
                            if PLAYWRIGHT_ENABLE:
                                try:
                                    detail_html = (
                                        await render_page_capture(
                                            detail_url,
                                            selectors=[
                                                "meta[property='og:title']",
                                                "script[type='application/ld+json']",
                                            ],
                                            click_selectors=[
                                                "#ccc-recommended-settings",
                                                "#ccc-accept-settings",
                                            ],
                                        )
                                    )[0]
                                except Exception:
                                    detail_html = None

                        if not detail_html or not (detail_html or "").strip():
                            return None

                        # Reject obvious challenge pages.
                        if _looks_blocked(detail_html, 200) or _has_cloudflare_marker(detail_html):
                            return None

                        parsed = _parse_otm_detail_page(
                            detail_html, detail_url, fallback_location=location
                        )
                        if not parsed:
                            return None

                        should_insert, reason = should_insert_property(parsed)
                        if not should_insert:
                            stats.log_validation_failure(reason or "Unknown")
                            return None

                        stats.log_parse_success()
                        return clean_property_data(parsed)

                for page in range(effective_max_pages):
                    url = _build_search_url(location, page)
                    try:
                        html = await _fetch_html(session, url)
                    except OnTheMarketBlockedError:
                        if page == 0:
                            raise
                        log_page_fetch_error("onthemarket", page, "blocked")
                        break

                    if not html:
                        log_page_fetch_error("onthemarket", page, "blocked or empty")
                        continue

                    soup = BeautifulSoup(html, "html.parser")
                    page_detail_urls = _collect_detail_listing_urls(soup)

                    # If we couldn't find detail links, try Playwright-rendered HTML (best-effort).
                    if not page_detail_urls and PLAYWRIGHT_ENABLE:
                        try:
                            rendered, _payloads = await render_page_capture(
                                url,
                                selectors=["a[href*='/details/']"],
                                click_selectors=[
                                    "#ccc-recommended-settings",
                                    "#ccc-accept-settings",
                                ],
                                response_url_substrings=["/api/", "/search"],
                                max_json=0,
                            )
                            if rendered:
                                soup2 = BeautifulSoup(rendered, "html.parser")
                                page_detail_urls = _collect_detail_listing_urls(soup2)
                        except Exception:
                            pass

                    for du in page_detail_urls:
                        if du in collected_seen:
                            continue
                        collected_seen.add(du)
                        collected_detail_urls.append(du)
                        if len(collected_detail_urls) >= effective_max_detail_urls:
                            break

                    if not page_detail_urls and page == 0:
                        # Old behavior preserved: if page 0 has no usable signals, stop.
                        print(
                            f"ℹ️ OnTheMarket: No detail links found on page {page}; stopping pagination."
                        )
                        break

                    if len(collected_detail_urls) >= effective_max_detail_urls:
                        break

                    await asyncio.sleep(OT_DELAY_MS / 1000.0)

                if not collected_detail_urls:
                    stats.log_summary()
                    runlog.set_count(0)
                    return []

                # Fetch + parse detail pages with bounded concurrency.
                tasks = [
                    asyncio.create_task(_fetch_parse_one(u))
                    for u in collected_detail_urls[:effective_max_detail_urls]
                ]
                stop_early = False
                try:
                    for fut in asyncio.as_completed(tasks):
                        item = await fut
                        if not item:
                            continue
                        ext = item.get("external_id")
                        if ext and str(ext) in seen_ids:
                            stats.log_duplicate_id(str(ext))
                            continue
                        if ext:
                            seen_ids.add(str(ext))
                        results.append(item)

                        if len(results) >= limit:
                            stop_early = True
                            break
                finally:
                    if stop_early:
                        for t in tasks:
                            if not t.done():
                                t.cancel()
                    # Always await task completion/cancellation to avoid warnings.
                    await asyncio.gather(*tasks, return_exceptions=True)

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
