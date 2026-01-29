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

from backend.scraper.utils import normalize_image_urls
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
    log_fetch_diagnostics,
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

    normalized = normalize_image_urls(candidates)
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

    location = fallback_location
    try:
        og_url = soup.find("meta", attrs={"property": "og:url"})
        _ = og_url  # unused; keep for future
    except Exception:
        pass

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
    image_url = image_urls[0] if image_urls else None

    return {
        "external_id": f"ot-{external_id}",
        "title": title or f"OnTheMarket listing {external_id}",
        "location": location,
        "price": price,
        "bedrooms": None,
        "bathrooms": None,
        "property_type": None,
        "image_url": image_url,
        "image_urls": image_urls,
        "imageurl": image_url,
        "latitude": 0.0,
        "longitude": 0.0,
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

    # Build a progressive attempt chain. This is OTM-only and should not affect other scrapers.
    attempts: List[Dict[str, Any]] = []
    if mode == "scraperapi":
        if not SCRAPERAPI_KEY:
            print(
                "⚠️ SCRAPER_MODE=scraperapi but SCRAPERAPI_KEY not set, falling back to direct fetch"
            )
            attempts.append({"via": "direct", "url": url, "timeout": 30})
        else:
            print(f"ℹ️ Using ScraperAPI for OnTheMarket HTML fetch: {url}")
            attempts.extend(
                [
                    {
                        "via": "scraperapi",
                        "url": make_scraperapi_url(
                            url, render=True, premium=False, keep_headers=True
                        ),
                        "timeout": 60,
                    },
                    {
                        "via": "scraperapi-premium",
                        "url": make_scraperapi_url(
                            url,
                            render=True,
                            premium=True,
                            keep_headers=True,
                            session_number=str(random.randint(1, 999999)),
                        ),
                        "timeout": 75,
                    },
                    # Some sites behave better when ScraperAPI does not forward headers.
                    {
                        "via": "scraperapi-premium-noheaders",
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
                        "via": "scraperapi-noheaders",
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
            )
    else:
        attempts.append({"via": "direct", "url": url, "timeout": 30})
        if SCRAPERAPI_KEY:
            attempts.extend(
                [
                    {
                        "via": "scraperapi-fallback",
                        "url": make_scraperapi_url(
                            url, render=True, premium=False, keep_headers=True
                        ),
                        "timeout": 60,
                    },
                    {
                        "via": "scraperapi-premium-fallback",
                        "url": make_scraperapi_url(
                            url,
                            render=True,
                            premium=True,
                            keep_headers=True,
                            session_number=str(random.randint(1, 999999)),
                        ),
                        "timeout": 75,
                    },
                    {
                        "via": "scraperapi-premium-noheaders-fallback",
                        "url": make_scraperapi_url(
                            url,
                            render=True,
                            premium=True,
                            keep_headers=False,
                            session_number=str(random.randint(1, 999999)),
                        ),
                        "timeout": 90,
                    },
                ]
            )

    last_text: Optional[str] = None
    try:
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
                log_fetch_diagnostics(
                    "onthemarket",
                    url,
                    status=int(status),
                    text=text,
                    via=via or ("scraperapi" if mode == "scraperapi" else "direct"),
                )

                blocked = (
                    _looks_blocked(text, int(status))
                    or _has_cloudflare_marker(text)
                    or not (text or "").strip()
                )

                hit = _captcha_hit_snippet(text)
                if hit:
                    print(f"⚠️ [onthemarket] captcha_detected=true {hit}")

                if not blocked:
                    return text

        # If it still looks blocked, return the last HTML anyway so downstream parsing
        # + validation can decide whether there are usable cards.
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
                for page in range(effective_max_pages):
                    url = _build_search_url(location, page)
                    html = await _fetch_html(session, url)
                    if not html:
                        log_page_fetch_error("onthemarket", page, "blocked or empty")
                        continue

                    soup = BeautifulSoup(html, "html.parser")
                    cards = _collect_cards(soup)

                    if not cards:
                        # Fallback: if card selectors fail, attempt to follow listing detail links.
                        detail_urls = _collect_detail_listing_urls(soup)
                        if detail_urls:
                            max_details = min(
                                len(detail_urls), max(3, min(12, limit - len(results)))
                            )
                            for detail_url in detail_urls[:max_details]:
                                if len(results) >= limit:
                                    break
                                try:
                                    detail_html = await _fetch_html(session, detail_url)
                                except Exception:
                                    detail_html = None
                                if detail_html and (
                                    _looks_blocked(detail_html, 200)
                                    or _has_cloudflare_marker(detail_html)
                                    or not (detail_html or "").strip()
                                ):
                                    detail_html = None
                                if not detail_html and PLAYWRIGHT_ENABLE:
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
                                if not detail_html:
                                    continue
                                parsed = _parse_otm_detail_page(
                                    detail_html, detail_url, fallback_location=location
                                )
                                if not parsed:
                                    continue
                                should_insert, reason = should_insert_property(parsed)
                                if should_insert:
                                    results.append(clean_property_data(parsed))
                                    stats.log_parse_success()
                                else:
                                    stats.log_validation_failure(reason or "Unknown")

                            if results:
                                stats.log_summary()
                                print(
                                    f"✅ OnTheMarket detail-page fallback returned {len(results)} properties"
                                )
                                runlog.set_count(len(results))
                                return results

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
                            image_urls = normalize_image_urls(image_urls)
                            filtered_urls = [u for u in image_urls if _is_otm_listing_photo_url(u)]
                            image_urls = filtered_urls or image_urls
                            image_url = image_urls[0] if image_urls else None
                            log_image_extraction("onthemarket", title, len(image_urls))

                            # Extract description
                            description = _extract_description(card)

                            # Generate external ID
                            external_id, listing_url = _extract_external_id_and_url(
                                card, title, location_text
                            )

                            # Enrich images from the detail page (best-effort).
                            # Keep this additive: only override if we actually find a gallery.
                            if listing_url and len(image_urls) < 12:
                                try:
                                    detail_html = await _fetch_html(session, listing_url)
                                except Exception:
                                    detail_html = None
                                if detail_html and (
                                    _looks_blocked(detail_html, 200)
                                    or _has_cloudflare_marker(detail_html)
                                    or not (detail_html or "").strip()
                                ):
                                    detail_html = None
                                if not detail_html and PLAYWRIGHT_ENABLE:
                                    try:
                                        detail_html = (
                                            await render_page_capture(
                                                listing_url,
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
                                if detail_html:
                                    try:
                                        detail_imgs = _extract_otm_gallery_image_urls(
                                            detail_html, listing_url
                                        )
                                        merged = normalize_image_urls([*detail_imgs, *image_urls])
                                        filtered_merged = [
                                            u for u in merged if _is_otm_listing_photo_url(u)
                                        ]
                                        merged = filtered_merged or merged
                                        if merged:
                                            image_urls = merged
                                            image_url = merged[0]
                                    except Exception:
                                        pass

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
                                "imageurl": image_url,
                                "latitude": coords["latitude"],
                                "longitude": coords["longitude"],
                                "source": "onthemarket",
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
                    await asyncio.sleep(OT_DELAY_MS / 1000.0)

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
