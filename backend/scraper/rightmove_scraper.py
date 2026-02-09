import asyncio
import hashlib
import json
import os
import random
import re
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup

from backend.scraper.utils import normalize_image_urls
from backend.utils.image_utils import dedupe_image_urls, pick_cover_image
from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.render import (
    PLAYWRIGHT_ENABLE,
    capture_debug_html,
    capture_debug_json,
    render_page,
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

# Bump this when listing/detail selectors materially change.
SELECTOR_VERSION = "v1"

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic", "bot detection"]


CONSENT_MARKERS = [
    "consent",
    "consent-manager",
    "sp-message",
    "didomi",
    "privacy",
    "gdpr",
    "cmp",
]


_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)


def _looks_like_postcode(s: str) -> bool:
    return bool(s and _POSTCODE_RE.search(s))


def _has_listings_signals(html: str) -> bool:
    lowered = (html or "").lower()
    return any(
        m in lowered
        for m in (
            "__next_data__",
            "__preloaded_state__",
            "propertycard",
            'data-testid="propertycard"',
            'data-test="propertycard"',
        )
    )


SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
RM_MAX_PAGES = int(os.getenv("RM_MAX_PAGES", "1"))
RM_DELAY_MS = int(os.getenv("RM_DELAY_MS", "800"))  # delay between pages (ms)
_LOCATION_IDENTIFIER = {
    # Common region codes; extend as needed (URL-encoded caret)
    "london": "REGION%5E87490",
}
RIGHTMOVE_API_BASE = "https://www.rightmove.co.uk/api/_search"
SCRAPERAPI_BASE = "https://api.scraperapi.com/"


def _extract_balanced_json_object(text: str, start_index: int) -> Optional[str]:
    """Extract a balanced JSON object starting at start_index (which must point at '{')."""
    if start_index < 0 or start_index >= len(text) or text[start_index] != "{":
        return None

    depth = 0
    in_string = False
    escape = False

    for i in range(start_index, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start_index : i + 1]

    return None


def _extract_preloaded_state(soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
    """Attempt to extract Rightmove embedded model JSON from __PRELOADED_STATE__."""
    scripts = soup.find_all("script")
    for script in scripts:
        script_text = script.string or script.get_text() or ""
        if "__PRELOADED_STATE__" not in script_text:
            continue

        # Common pattern: window.__PRELOADED_STATE__ = { ... }
        idx = script_text.find("__PRELOADED_STATE__")
        brace_start = script_text.find("{", idx)
        if brace_start != -1:
            raw = _extract_balanced_json_object(script_text, brace_start)
            if raw:
                try:
                    return json.loads(raw)
                except Exception:
                    # brace_start can hit the '{' inside a JSON.parse("{...}") string.
                    # In that case json.loads(raw) will fail due to escaped quotes.
                    # Continue to the JSON.parse(...) extraction below instead.
                    pass

        # Alternative pattern: window.__PRELOADED_STATE__ = JSON.parse("...")
        m = re.search(r"__PRELOADED_STATE__\s*=\s*JSON\.parse\((['\"])(.*?)\1\)", script_text)
        if m:
            encoded = m.group(2)
            try:
                decoded = json.loads(f'"{encoded}"')
                return json.loads(decoded)
            except Exception:
                continue

    return None


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


def _extract_rightmove_detail_image_urls(html: str, page_url: str) -> List[str]:
    """Extract gallery images from a Rightmove detail page (best-effort)."""
    if not html:
        return []

    soup = BeautifulSoup(html or "", "html.parser")
    candidates: List[str] = []

    def _canonicalize_rightmove_media_url(u: str) -> str:
        # Prefer a stable, original-ish URL for de-duping.
        u2 = u.strip()
        u2 = u2.replace("//media.rightmove.co.uk/dir/", "//media.rightmove.co.uk/")
        u2 = u2.replace("https://media.rightmove.co.uk/dir/", "https://media.rightmove.co.uk/")
        u2 = u2.replace("http://media.rightmove.co.uk/dir/", "http://media.rightmove.co.uk/")
        u2 = re.sub(
            r"_max_[^./]+(?=\.(?:jpe?g|png|webp)$)",
            "",
            u2,
            flags=re.IGNORECASE,
        )
        return u2

    def _looks_like_rightmove_property_photo(u: str) -> bool:
        ul = (u or "").lower()
        if "media.rightmove.co.uk" not in ul:
            return False
        if any(x in ul for x in ("brand_logo", "/assets/", "/dir/customer/")):
            return False
        if any(x in ul for x in ("industry-affiliation", "customer/industry-affiliation")):
            return False
        if any(x in ul for x in ("_flp_", "_epc_")):
            return False
        # Property photos use *_IMG_* naming in practice.
        return "_img_" in ul

    # 1) JSON-LD structured data (often includes image arrays).
    try:
        for el in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = (el.string or el.get_text() or "").strip()
            if not raw:
                continue
            try:
                data = json.loads(raw)
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

    # 2) Embedded app state (__PRELOADED_STATE__ / __NEXT_DATA__).
    try:
        state = _extract_preloaded_state(soup)
    except Exception:
        state = None
    try:
        next_data = _extract_next_data(soup)
    except Exception:
        next_data = None

    def _scan_state(obj: Any, depth: int = 0) -> None:
        if depth > 12:
            return
        if isinstance(obj, str):
            s = obj.strip()
            if not s:
                return
            sl = s.lower()
            if ("media.rightmove" in sl) or ("rightmove.co.uk" in sl) or sl.startswith("http"):
                candidates.append(urljoin(page_url, s))
            return
        if isinstance(obj, list):
            for v in obj:
                _scan_state(v, depth + 1)
            return
        if isinstance(obj, dict):
            for k, v in obj.items():
                kl = str(k).lower()
                if kl in ("image", "images", "imageurl", "imageurls", "media", "photos", "gallery"):
                    _scan_state(v, depth + 1)
                    continue
                if kl in ("url", "src", "mediaurl", "original", "full", "large"):
                    _scan_state(v, depth + 1)
                    continue
                _scan_state(v, depth + 1)

    if isinstance(state, dict):
        _scan_state(state)
    if isinstance(next_data, dict):
        _scan_state(next_data)

    # 2b) Regex scan for embedded media URLs (some PDPs inline JSON without __PRELOADED_STATE__/__NEXT_DATA__).
    try:
        for u in re.findall(
            r"https?://media\.rightmove\.co\.uk/[^\"'<>\\\s]+\.(?:jpe?g|png|webp)",
            html,
            flags=re.IGNORECASE,
        ):
            if isinstance(u, str) and u.strip():
                candidates.append(u.strip())
    except Exception:
        pass

    # 3) HTML gallery/carousel images.
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

    # 4) Responsive picture sources.
    try:
        for el in soup.select("source[srcset], img[srcset]"):
            srcset = el.get("srcset")
            if isinstance(srcset, str) and srcset.strip():
                best = _pick_best_from_srcset(srcset)
                if best:
                    candidates.append(urljoin(page_url, best))
    except Exception:
        pass

    # 5) og:image fallback.
    try:
        og_img = soup.find("meta", attrs={"property": "og:image"})
        if og_img and og_img.get("content"):
            candidates.append(urljoin(page_url, str(og_img.get("content")).strip()))
    except Exception:
        pass

    # Prefer best variants and drop non-photo media.
    try:
        ordered_best: Dict[str, str] = {}
        ordered_keys: List[str] = []

        for u in candidates:
            if not isinstance(u, str) or not u.strip():
                continue
            u = urljoin(page_url, u.strip())
            if not _looks_like_rightmove_property_photo(u):
                continue

            key = _canonicalize_rightmove_media_url(u)
            if key not in ordered_best:
                ordered_best[key] = u
                ordered_keys.append(key)
                continue

            existing = ordered_best[key]
            # Prefer originals over resized variants.
            new_score = ("/dir/" in u.lower(), "_max_" in u.lower(), len(u))
            old_score = ("/dir/" in existing.lower(), "_max_" in existing.lower(), len(existing))
            if new_score < old_score:
                ordered_best[key] = u

        candidates = [ordered_best[k] for k in ordered_keys]
    except Exception:
        pass

    return normalize_image_urls(candidates)


async def _enrich_rightmove_results_with_detail_images(
    session: aiohttp.ClientSession,
    results: List[Dict[str, Any]],
    *,
    max_items: int = 6,
) -> None:
    """Best-effort: fetch detail pages and merge gallery images into image_urls."""
    if not results:
        return

    for p in results[: max(0, int(max_items))]:
        try:
            detail_url = (
                p.get("listing_url") or p.get("raw_url") or p.get("url") or p.get("property_url")
            )
            if not isinstance(detail_url, str) or not detail_url.strip():
                continue
            detail_url = detail_url.strip()

            existing = p.get("image_urls")
            existing_list: List[str] = existing if isinstance(existing, list) else []
            if len(existing_list) >= 12:
                continue

            try:
                detail_html = await _fetch_html(session, detail_url)
            except Exception:
                detail_html = None
            if not detail_html:
                continue

            detail_imgs = _extract_rightmove_detail_image_urls(detail_html, detail_url)
            merged = normalize_image_urls([*detail_imgs, *existing_list])
            if not merged:
                continue

            p["image_urls"] = merged
            p["image_url"] = merged[0]
            p["imageurl"] = merged[0]
        except Exception:
            continue


def _find_rightmove_properties_in_next_data(next_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Try to locate a Rightmove listings/properties list inside __NEXT_DATA__."""
    if not isinstance(next_data, dict):
        return []

    preferred_keys = (
        "properties",
        "propertyList",
        "results",
        "searchResults",
        "listings",
        "propertyResults",
    )

    def _unwrap(d: Any) -> Any:
        if isinstance(d, dict):
            # Some payloads nest the actual listing under a subkey.
            for k in ("property", "listing", "result", "data"):
                if k in d and isinstance(d[k], dict):
                    return d[k]
        return d

    def _looks_like_property_dict(d: Any) -> bool:
        d = _unwrap(d)
        if not isinstance(d, dict):
            return False
        has_id = any(k in d for k in ("id", "propertyId", "listingId", "identifier"))
        has_addr = any(k in d for k in ("displayAddress", "address", "summary"))
        has_price = "price" in d or "priceAmount" in d
        return bool(has_id and (has_addr or has_price))

    def _scan(obj: Any, depth: int = 0) -> Optional[List[Dict[str, Any]]]:
        if depth > 9:
            return None
        if isinstance(obj, dict):
            for k in preferred_keys:
                v = obj.get(k)
                if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
                    if sum(1 for x in v if _looks_like_property_dict(x)) >= max(1, len(v) // 4):
                        return v  # type: ignore[return-value]
            for v in obj.values():
                found = _scan(v, depth + 1)
                if found:
                    return found
        elif isinstance(obj, list):
            if obj and all(isinstance(x, dict) for x in obj):
                if sum(1 for x in obj if _looks_like_property_dict(x)) >= max(1, len(obj) // 4):
                    return obj  # type: ignore[return-value]
            for v in obj:
                found = _scan(v, depth + 1)
                if found:
                    return found
        return None

    found = _scan(next_data)
    return found or []


def _find_rightmove_properties_in_state(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Try to locate a properties list inside the preloaded state."""
    if not isinstance(state, dict):
        return []

    # Prefer common known paths first.
    candidates: List[Any] = []
    for path in (
        ("searchResults", "properties"),
        ("properties",),
        ("results", "properties"),
        ("propertySearch", "properties"),
    ):
        cur: Any = state
        ok = True
        for key in path:
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                ok = False
                break
        if ok:
            candidates.append(cur)

    def _looks_like_property_dict(d: Any) -> bool:
        if not isinstance(d, dict):
            return False
        has_id = any(k in d for k in ("id", "propertyId", "listingId", "identifier"))
        has_addr = any(k in d for k in ("displayAddress", "address", "summary"))
        has_price = "price" in d or "priceAmount" in d
        return bool(has_id and (has_addr or has_price))

    def _find_list(obj: Any, depth: int = 0) -> Optional[List[Dict[str, Any]]]:
        if depth > 7:
            return None
        if isinstance(obj, list) and obj and all(isinstance(x, dict) for x in obj):
            if sum(1 for x in obj if _looks_like_property_dict(x)) >= max(1, len(obj) // 4):
                return obj  # type: ignore[return-value]
        if isinstance(obj, dict):
            for v in obj.values():
                found = _find_list(v, depth + 1)
                if found:
                    return found
        if isinstance(obj, list):
            for v in obj:
                found = _find_list(v, depth + 1)
                if found:
                    return found
        return None

    for c in candidates:
        found = _find_list(c)
        if found:
            return found

    # Fall back to a bounded recursive scan of the entire state.
    found = _find_list(state)
    return found or []


def _rm_property_from_api_dict(p: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        property_id = str(
            p.get("id") or p.get("propertyId") or p.get("identifier") or p.get("listingId") or ""
        )
        if not property_id:
            return None

        title = p.get("displayAddress") or p.get("address") or p.get("summary") or "Untitled"

        description = p.get("summary") or p.get("propertySubType") or None
        if description and isinstance(description, str) and len(description) > 20:
            description = description.strip()
        else:
            description = None

        property_type_raw = p.get("propertySubType") or p.get("propertyType") or ""
        property_type = _normalize_property_type(property_type_raw) if property_type_raw else None

        price_obj = p.get("price") or {}
        price = None
        if isinstance(price_obj, dict):
            price = price_obj.get("amount") or price_obj.get("price")
        elif isinstance(price_obj, (int, float)):
            price = int(price_obj)

        bedrooms = p.get("bedrooms") or p.get("numBedrooms") or 0
        bathrooms = p.get("bathrooms") or p.get("numBathrooms") or 0

        image_urls: List[str] = []
        media = p.get("media") or []
        if isinstance(media, list) and media:
            for m in media:
                if isinstance(m, dict):
                    img = m.get("url") or m.get("mediaUrl")
                    if img and isinstance(img, str):
                        image_urls.append(img)

        image_urls = normalize_image_urls(
            [urljoin("https://www.rightmove.co.uk/", u) for u in image_urls if isinstance(u, str)]
        )
        try:
            image_urls = dedupe_image_urls(image_urls, base_url="https://www.rightmove.co.uk/")
        except Exception:
            pass
        img = pick_cover_image(image_urls) if image_urls else None

        loc_text = title
        loc_lat: float | None = None
        loc_lng: float | None = None
        geo = p.get("location") or {}
        if isinstance(geo, dict):
            try:
                loc_lat = float(geo.get("latitude")) if geo.get("latitude") is not None else None
            except Exception:
                loc_lat = None
            try:
                loc_lng = float(geo.get("longitude")) if geo.get("longitude") is not None else None
            except Exception:
                loc_lng = None

        if loc_lat == 0.0:
            loc_lat = None
        if loc_lng == 0.0:
            loc_lng = None

        return {
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
            "imageurl": img,
            "latitude": loc_lat,
            "longitude": loc_lng,
            "source": "rightmove",
            "raw_url": f"https://www.rightmove.co.uk/properties/{property_id}",
        }
    except Exception:
        return None


def make_scraperapi_url(
    target_url: str,
    *,
    render: bool = False,
    premium: bool = False,
    ultra_premium: bool = False,
    country_code: Optional[str] = "gb",
    session_number: Optional[str] = None,
    keep_headers: Optional[bool] = True,
    auto_session_number: bool = True,
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

    params: Dict[str, Any] = {
        "api_key": api_key,
        "render": "true" if render else None,
        "premium": "true" if premium else None,
        "ultra_premium": "true" if ultra_premium else None,
        "url": target_url,
    }

    # Optional behavior toggles. When omitted (None), ScraperAPI uses its defaults.
    if country_code is not None:
        params["country_code"] = country_code or "gb"
    if keep_headers is not None:
        params["keep_headers"] = "true" if keep_headers else None

    # Drop None values to avoid render=None in the query string.
    params = {k: v for k, v in params.items() if v is not None}

    if render:
        params["device_type"] = "desktop"

    # Optional session pinning / sharding.
    if session_number:
        params["session_number"] = str(session_number)
    elif auto_session_number:
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


def _has_consent_marker(html: str) -> bool:
    lowered = (html or "").lower()
    return any(k in lowered for k in CONSENT_MARKERS)


def _has_challenge_marker(html: str) -> bool:
    lowered = (html or "").lower()
    return any(
        marker in lowered
        for marker in (
            "cdn-cgi",
            "challenge-platform",
            "cf-chl-",
            "cf_chl_",
            "checking your browser before accessing",
            "attention required! | cloudflare",
            "turnstile",
        )
    )


def _is_place_not_found_variant(html: str) -> bool:
    lowered = (html or "").lower()
    return any(
        k in lowered
        for k in (
            "page-not-found",
            "page not found",
            "we couldn't find",
            "we couldn’t find",
            "find the place you were looking for",
        )
    )


def _rightmove_caret_url_variants(url: str) -> List[str]:
    """Return retry targets that include both '^' and '%5E' caret variants.

    Rightmove region identifiers commonly appear as `REGION^12345` or `REGION%5E12345`.
    We've seen the HTML response vary (including the deceptive "place not found" variant)
    depending on whether the caret is percent-encoded, so ensure we try both.
    """

    url = url or ""
    variants: List[str] = []

    # Prefer unescaped caret first.
    if "%5e" in url.lower():
        unescaped = re.sub(r"%5e", "^", url, flags=re.IGNORECASE)
        if unescaped and unescaped != url:
            variants.append(unescaped)

    # Original always included.
    if url:
        variants.append(url)

    # Also try the encoded form when the URL contains a caret.
    if "^" in url:
        encoded = url.replace("^", "%5E")
        if encoded and encoded != url:
            variants.append(encoded)

    # De-dup while preserving order.
    out: List[str] = []
    seen = set()
    for v in variants:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _extract_location_identifier(url: str) -> Optional[str]:
    try:
        q = parse_qs(urlparse(url).query)
        loc = (q.get("locationIdentifier") or [None])[0]
        return str(loc) if loc else None
    except Exception:
        return None


def _extract_page_index(url: str) -> int:
    """Best-effort page index extraction for minimal-URL fallback.

    Rightmove uses multiple pagination styles:
    - paginationIndex=0,1,2...
    - index=0,24,48... (offset)
    """

    try:
        q = parse_qs(urlparse(url).query)
        if "paginationIndex" in q and q["paginationIndex"]:
            return max(0, int(str(q["paginationIndex"][0])))
        if "index" in q and q["index"]:
            offset = int(str(q["index"][0]))
            return max(0, offset // 24)
    except Exception:
        return 0
    return 0


def _is_region_location_identifier(loc: Optional[str]) -> bool:
    if not loc:
        return False
    return str(loc).upper().startswith("REGION") and ("^" in loc or "%5E" in loc.upper())


def _build_minimal_region_find_url(location_identifier: str, page: int) -> str:
    # Ensure we match the support-confirmed minimal format (encoded caret, no extra filters).
    li = str(location_identifier)
    li = re.sub(r"%5e", "%5E", li, flags=re.IGNORECASE)
    li = li.replace("^", "%5E")
    base = "https://www.rightmove.co.uk/property-for-sale/find.html"
    return (
        f"{base}?locationIdentifier={li}&sortType=2&includeSSTC=false&paginationIndex={int(page)}"
    )


def _build_search_url(location: str, page: int = 0) -> str:
    """
    Rightmove listing pages use paginationIndex (offset). locationIdentifier can be derived
    via an initial search API call; for a generic free-text we rely on searchLocation.
    NOTE: For higher accuracy you may resolve locationIdentifier separately.
    """
    encoded = location.strip()
    loc_key = encoded.lower()
    base = "https://www.rightmove.co.uk/property-for-sale/find.html"

    # Pragmatic reliability fix: London is known-good via REGION identifier.
    # Avoid free-text searchLocation flows which can vary and omit embedded state.
    if loc_key == "london":
        params = [
            "locationIdentifier=REGION%5E87490",
            "sortType=2",
            "propertyTypes=&mustHave=&dontShow=houseShare%2Cretirement%2CsharedOwnership",
            "furnishTypes=&keywords=",
            "includeSSTC=false",
            # Rightmove HTML pagination uses paginationIndex=0,1,2... for listings pages.
            f"paginationIndex={int(page)}",
        ]
        return f"{base}?{'&'.join(params)}"

    params = [
        # Prefer region identifier when known; improves reliability
        (
            f"locationIdentifier={_LOCATION_IDENTIFIER.get(loc_key, '')}"
            if loc_key in _LOCATION_IDENTIFIER
            else f"searchLocation={encoded}"
        ),
        "sortType=2",
        "propertyTypes=&mustHave=&dontShow=houseShare%2Cretirement%2CsharedOwnership",
        "furnishTypes=&keywords=",
        # Prefer paginationIndex for the HTML listing pages.
        # Keep index-based pagination for free-text searches, which can still accept index offsets.
        f"paginationIndex={int(page)}" if loc_key in _LOCATION_IDENTIFIER else f"index={page * 24}",
    ]
    return f"{base}?{'&'.join(params)}"


async def _fetch_html_internal(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Internal fetch function with retry logic."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

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
            # Rightmove typically includes embedded state in the HTML; rendering increases latency.
            url_to_fetch = make_scraperapi_url(url, render=False)
            print(f"ℹ️ Using ScraperAPI for Rightmove HTML fetch: {url}")
    else:
        # Direct mode - use original URL
        url_to_fetch = url

    # Fetch the URL (either direct or via ScraperAPI)
    try:
        async with session.get(
            url_to_fetch, headers=headers, timeout=60 if mode == "scraperapi" else 30
        ) as resp:
            text = await resp.text()
            log_fetch_diagnostics(
                "rightmove",
                url,
                status=resp.status,
                text=text,
                via="scraperapi" if mode == "scraperapi" else "direct",
            )

            # If ScraperAPI mode and the response looks like a non-listings/soft-block page,
            # retry once with a fresh session_number (keep render off for latency).
            if (
                mode == "scraperapi"
                and SCRAPERAPI_KEY
                and resp.status == 200
                and (text or "").strip()
                and (not _has_listings_signals(text))
            ):
                try:
                    retry_url = make_scraperapi_url(
                        url,
                        render=False,
                        premium=_has_challenge_marker(text)
                        or any(k in (text or "").lower() for k in CAPTCHA_KEYWORDS),
                        ultra_premium=False,
                        session_number=str(random.randint(1, 999999)),
                    )
                    async with session.get(retry_url, headers=headers, timeout=75) as r_resp:
                        r_text = await r_resp.text()
                        log_fetch_diagnostics(
                            "rightmove",
                            url,
                            status=r_resp.status,
                            text=r_text,
                            via="scraperapi-session-retry",
                        )
                        if r_resp.status == 200 and (r_text or "").strip():
                            text = r_text
                except Exception:
                    pass

            # If we see the deceptive "place not found" variant (200 OK, no cards/Next.js),
            # retry using the support-confirmed EXACT minimal URL + plain ScraperAPI call.
            # IMPORTANT: do not gate on marker presence; the deceptive page can include unrelated
            # embedded scripts and still be a soft-block.
            if (
                mode == "scraperapi"
                and SCRAPERAPI_KEY
                and resp.status == 200
                and (text or "").strip()
                and _is_place_not_found_variant(text)
            ):
                loc_id = _extract_location_identifier(url)
                if _is_region_location_identifier(loc_id):
                    page_idx = _extract_page_index(url)
                    minimal_target = _build_minimal_region_find_url(str(loc_id), page_idx)

                    # Support-confirmed: start with a plain ScraperAPI call (no extra params).
                    # In production we've seen the deceptive variant persist even on the minimal URL,
                    # so also try country_code targeting (still no keep_headers/session pinning)
                    # before escalating premium/render.
                    attempts = [
                        (
                            "rightmove-minimal-url-retry",
                            dict(
                                render=False,
                                premium=False,
                                ultra_premium=False,
                                country_code=None,
                                keep_headers=None,
                                session_number=None,
                                auto_session_number=False,
                            ),
                            90,
                        ),
                        (
                            "rightmove-minimal-url-retry-gb",
                            dict(
                                render=False,
                                premium=False,
                                ultra_premium=False,
                                country_code="gb",
                                keep_headers=None,
                                session_number=None,
                                auto_session_number=False,
                            ),
                            90,
                        ),
                        (
                            "rightmove-minimal-url-retry-uk",
                            dict(
                                render=False,
                                premium=False,
                                ultra_premium=False,
                                country_code="uk",
                                keep_headers=None,
                                session_number=None,
                                auto_session_number=False,
                            ),
                            90,
                        ),
                        (
                            "rightmove-minimal-url-premium-retry",
                            dict(
                                render=False,
                                premium=True,
                                ultra_premium=False,
                                country_code=None,
                                keep_headers=None,
                                session_number=str(random.randint(1, 999999)),
                                auto_session_number=False,
                            ),
                            110,
                        ),
                        (
                            "rightmove-minimal-url-premium-render-retry",
                            dict(
                                render=True,
                                premium=True,
                                ultra_premium=False,
                                country_code=None,
                                keep_headers=None,
                                session_number=str(random.randint(1, 999999)),
                                auto_session_number=False,
                            ),
                            150,
                        ),
                        (
                            "rightmove-minimal-url-ultra-premium-retry",
                            dict(
                                render=False,
                                premium=False,
                                ultra_premium=True,
                                country_code=None,
                                keep_headers=None,
                                session_number=str(random.randint(1, 999999)),
                                auto_session_number=False,
                            ),
                            120,
                        ),
                    ]

                    for via, opts, timeout_s in attempts:
                        try:
                            retry_url = make_scraperapi_url(minimal_target, **opts)
                            async with session.get(
                                retry_url, headers=headers, timeout=timeout_s
                            ) as r_resp:
                                r_text = await r_resp.text()
                                log_fetch_diagnostics(
                                    "rightmove",
                                    minimal_target,
                                    status=r_resp.status,
                                    text=r_text,
                                    via=via,
                                )
                                if r_resp.status == 200 and (r_text or "").strip():
                                    text = r_text
                                if _has_listings_signals(text):
                                    break
                        except Exception:
                            continue
                else:
                    # Non-REGION flows: keep the existing escalation ladder.
                    # Known edge-case: percent-encoded carets in REGION identifiers (%5E)
                    # can trigger a "place not found" variant. Ensure we try both forms.
                    retry_targets = _rightmove_caret_url_variants(url)

                    attempts = [
                        (
                            "scraperapi-premium-retry",
                            dict(premium=True, ultra_premium=False, render=False),
                            90,
                        ),
                        (
                            "scraperapi-premium-render-retry",
                            dict(premium=True, ultra_premium=False, render=True),
                            140,
                        ),
                        (
                            "scraperapi-ultra-premium-retry",
                            dict(premium=False, ultra_premium=True, render=False),
                            90,
                        ),
                        (
                            "scraperapi-ultra-premium-render-retry",
                            dict(premium=False, ultra_premium=True, render=True),
                            140,
                        ),
                    ]

                    for target_url in retry_targets:
                        for cc in ("gb", "uk"):
                            for via, opts, timeout_s in attempts:
                                try:
                                    retry_url = make_scraperapi_url(
                                        target_url,
                                        country_code=cc,
                                        session_number=str(random.randint(1, 999999)),
                                        **opts,
                                    )
                                    async with session.get(
                                        retry_url, headers=headers, timeout=timeout_s
                                    ) as r_resp:
                                        r_text = await r_resp.text()
                                        log_fetch_diagnostics(
                                            "rightmove",
                                            target_url,
                                            status=r_resp.status,
                                            text=r_text,
                                            via=f"{via}-{cc}",
                                        )
                                        if r_resp.status == 200 and (r_text or "").strip():
                                            text = r_text
                                        if _has_listings_signals(text):
                                            break
                                except Exception:
                                    continue
                            if _has_listings_signals(text):
                                break
                        if _has_listings_signals(text):
                            break

            # If direct mode and we detect blocking, try ScraperAPI as fallback
            if mode == "direct" and _looks_blocked(text, resp.status) and SCRAPERAPI_KEY:
                log_scraperapi_fallback("rightmove", url)
                proxy_url = make_scraperapi_url(url, render=False)
                print(f"ℹ️ Fallback to ScraperAPI for blocked URL: {url}")
                try:
                    async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                        p_text = await p_resp.text()
                        log_fetch_diagnostics(
                            "rightmove",
                            url,
                            status=p_resp.status,
                            text=p_text,
                            via="scraperapi-fallback",
                        )
                        if _looks_blocked(p_text, p_resp.status):
                            return None
                        return p_text
                except Exception:
                    return None

            # If still looks blocked, return None
            if _looks_blocked(text, resp.status):
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
                proxy_url = make_scraperapi_url(url, render=False)
                async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                    p_text = await p_resp.text()
                    log_fetch_diagnostics(
                        "rightmove",
                        url,
                        status=p_resp.status,
                        text=p_text,
                        via="scraperapi-exception-fallback",
                    )
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
        exceptions=(aiohttp.ClientError, asyncio.TimeoutError),
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
            img.get("data-src")
            or img.get("src")
            or img.get("data-lazy-src")
            or img.get("data-original")
        )

        if url and isinstance(url, str):
            url = url.strip()
            # Skip placeholder/tracking pixels
            if url and not any(x in url.lower() for x in ["placeholder", "blank", "1x1", "pixel"]):
                # Make relative URLs absolute
                if url.startswith("//"):
                    url = "https:" + url
                elif url.startswith("/"):
                    url = "https://www.rightmove.co.uk" + url
                images.append(url)

    # Also check for srcset attribute which may have higher resolution images
    for img in card.select("img[srcset]"):
        srcset = img.get("srcset", "")
        if srcset:
            # Parse srcset format: "url1 width1, url2 width2, ..."
            for item in srcset.split(","):
                parts = item.strip().split()
                if parts:
                    url = parts[0].strip()
                    if url and not any(x in url.lower() for x in ["placeholder", "blank", "1x1"]):
                        if url.startswith("//"):
                            url = "https:" + url
                        elif url.startswith("/"):
                            url = "https://www.rightmove.co.uk" + url
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
        card.select_one(".propertyCard-description")
        or card.select_one("[data-testid='description']")
        or card.select_one(".property-description")
        or card.select_one("[itemprop='description']")
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
        card.select_one("[data-testid='property-type']")
        or card.select_one(".propertyCard-propertyType")
        or card.select_one(".property-information")
        or card.select_one(".propertyType")
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


def _stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _extract_external_id_and_url(
    card: BeautifulSoup, *, title: str, location: str
) -> tuple[str, Optional[str]]:
    link = card.select_one("a[href*='/properties/']")
    href = link.get("href") if link else None

    listing_url = None
    if href and isinstance(href, str):
        listing_url = href if href.startswith("http") else f"https://www.rightmove.co.uk{href}"
        m = re.search(r"/properties/(\d+)", href)
        if m:
            return m.group(1), listing_url

    data_id = card.get("data-id")
    if data_id:
        return str(data_id), listing_url

    signature = listing_url or f"{title}|{location}"
    return f"rm-{_stable_id(signature)}", listing_url


def _collect_selectors(soup: BeautifulSoup) -> List[BeautifulSoup]:
    selectors = [
        "[data-testid='propertyCard']",
        "[data-test='propertyCard']",
        "[data-test='property-card']",
        ".propertyCard",
        "article.propertyCard",
    ]
    cards = []
    for sel in selectors:
        found = soup.select(sel)
        if found:
            cards.extend(found)

    # Guard against overly broad matches (e.g. nested .propertyCard-* elements):
    # only treat nodes as cards when they contain a listing link.
    cards = [c for c in cards if c.select_one("a[href*='/properties/']") is not None]
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

    # Start audit logging
    with RunLog.start(source="rightmove", mode=SCRAPER_MODE, location=location) as run_log:
        try:
            async with aiohttp.ClientSession() as session:
                # 1. Attempt JSON API first for efficiency & reliability
                loc_key = (location or "").strip().lower()
                region_id = _LOCATION_IDENTIFIER.get(loc_key)
                api_results: List[Dict[str, Any]] = []
                if region_id:
                    try:
                        api_results = await _fetch_api_properties(session, region_id, limit)
                        if api_results:
                            print(
                                f"✅ Rightmove API returned {len(api_results)} properties for '{location}'"
                            )
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
                            results = validated_results[:limit]
                            run_log.set_count(len(results))
                            return results
                        else:
                            print(
                                "ℹ️ Rightmove API returned zero properties; falling back to HTML scraping."
                            )
                    except Exception as e:
                        print(f"⚠️ Rightmove API fetch error: {e}; falling back to HTML scraping.")
                for page in range(RM_MAX_PAGES):
                    url = _build_search_url(location, page)
                    html = await _fetch_html(session, url)
                    # Playwright fallback if enabled and static HTML yielded no cards later
                    if not html:
                        if PLAYWRIGHT_ENABLE:
                            rendered = await render_page(
                                url,
                                [
                                    "[data-testid='propertyCard']",
                                    "article.propertyCard",
                                    ".propertyCard",
                                ],
                            )
                            if rendered:
                                html = rendered
                            else:
                                log_page_fetch_error("rightmove", page, "blocked or empty")
                                continue
                        else:
                            log_page_fetch_error("rightmove", page, "blocked or empty")
                            continue
                    soup = BeautifulSoup(html, "html.parser")

                    # 1) Prefer Next.js JSON payload when present.
                    next_data = _extract_next_data(soup)
                    next_props = (
                        _find_rightmove_properties_in_next_data(next_data) if next_data else []
                    )
                    if next_props:
                        for p in next_props:
                            if len(results) >= limit:
                                break
                            # Some payloads nest listing under a subkey.
                            if isinstance(p, dict) and any(
                                k in p and isinstance(p[k], dict)
                                for k in ("property", "listing", "result", "data")
                            ):
                                for k in ("property", "listing", "result", "data"):
                                    if k in p and isinstance(p[k], dict):
                                        p = p[k]  # type: ignore[assignment]
                                        break
                            mapped = _rm_property_from_api_dict(p)
                            if not mapped:
                                continue
                            should_insert, reason = should_insert_property(mapped)
                            if should_insert:
                                results.append(clean_property_data(mapped))
                                stats.log_parse_success()
                            else:
                                stats.log_validation_failure(reason or "Unknown")

                        if results:
                            await _enrich_rightmove_results_with_detail_images(session, results)
                            stats.log_summary()
                            print(
                                f"✅ Rightmove __NEXT_DATA__ returned {len(results)} properties for '{location}'"
                            )
                            run_log.set_count(len(results))
                            return results

                    # If the DOM doesn't contain cards, try the embedded state model.
                    embedded_state = _extract_preloaded_state(soup)
                    embedded_props = (
                        _find_rightmove_properties_in_state(embedded_state)
                        if embedded_state
                        else []
                    )
                    if embedded_props:
                        for p in embedded_props:
                            if len(results) >= limit:
                                break
                            mapped = _rm_property_from_api_dict(p)
                            if not mapped:
                                continue
                            should_insert, reason = should_insert_property(mapped)
                            if should_insert:
                                results.append(clean_property_data(mapped))
                                stats.log_parse_success()
                            else:
                                stats.log_validation_failure(reason or "Unknown")

                        if results:
                            await _enrich_rightmove_results_with_detail_images(session, results)
                            stats.log_summary()
                            print(
                                f"✅ Rightmove embedded JSON returned {len(results)} properties for '{location}'"
                            )
                            run_log.set_count(len(results))
                            return results

                    cards = _collect_selectors(soup)

                    # Conditional ScraperAPI render retry when parsing yields 0 and we see explicit challenge/captcha markers.
                    # This avoids wasting render credits on pages that already contain embedded JSON.
                    if (
                        (not results)
                        and (not cards)
                        and SCRAPERAPI_KEY
                        and (
                            _has_consent_marker(html)
                            or _has_challenge_marker(html)
                            or any(k in (html or "").lower() for k in CAPTCHA_KEYWORDS)
                        )
                    ):
                        try:
                            retry_url = make_scraperapi_url(
                                url,
                                render=True,
                                premium=_has_challenge_marker(html)
                                or any(k in (html or "").lower() for k in CAPTCHA_KEYWORDS),
                                session_number=str(random.randint(1, 999999)),
                            )
                            async with session.get(
                                retry_url, headers={"User-Agent": USER_AGENT}, timeout=75
                            ) as r:
                                r_text = await r.text()
                                log_fetch_diagnostics(
                                    "rightmove",
                                    url,
                                    status=r.status,
                                    text=r_text,
                                    via="scraperapi-render-retry",
                                )
                                retry_soup = BeautifulSoup(r_text, "html.parser")

                                retry_next = _extract_next_data(retry_soup)
                                retry_next_props = (
                                    _find_rightmove_properties_in_next_data(retry_next)
                                    if retry_next
                                    else []
                                )
                                if retry_next_props:
                                    for p in retry_next_props:
                                        if len(results) >= limit:
                                            break
                                        if isinstance(p, dict) and any(
                                            k in p and isinstance(p[k], dict)
                                            for k in ("property", "listing", "result", "data")
                                        ):
                                            for k in ("property", "listing", "result", "data"):
                                                if k in p and isinstance(p[k], dict):
                                                    p = p[k]  # type: ignore[assignment]
                                                    break
                                        mapped = _rm_property_from_api_dict(p)
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
                                            f"✅ Rightmove render retry (__NEXT_DATA__) returned {len(results)} properties for '{location}'"
                                        )
                                        run_log.set_count(len(results))
                                        return results

                                retry_state = _extract_preloaded_state(retry_soup)
                                retry_props = (
                                    _find_rightmove_properties_in_state(retry_state)
                                    if retry_state
                                    else []
                                )
                                if retry_props:
                                    for p in retry_props:
                                        if len(results) >= limit:
                                            break
                                        mapped = _rm_property_from_api_dict(p)
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
                                            f"✅ Rightmove render retry (__PRELOADED_STATE__) returned {len(results)} properties for '{location}'"
                                        )
                                        run_log.set_count(len(results))
                                        return results

                                retry_cards = _collect_selectors(retry_soup)
                                if retry_cards:
                                    soup = retry_soup
                                    cards = retry_cards
                        except Exception:
                            pass
                    if not cards:
                        if PLAYWRIGHT_ENABLE:
                            rendered = await render_page(
                                url,
                                [
                                    "[data-testid='propertyCard']",
                                    "[data-test='propertyCard']",
                                    "article.propertyCard",
                                    ".propertyCard",
                                ],
                            )
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

                            price_el = card.select_one(
                                ".propertyCard-priceValue"
                            ) or card.select_one("[data-testid='price']")
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

                            baths_el = card.select_one(
                                "[data-testid='bathrooms']"
                            ) or card.select_one(".baths")
                            bathrooms = _extract_int(baths_el.get_text() if baths_el else "") or 0

                            # Extract all images
                            image_urls = _extract_images(card)
                            image_urls = normalize_image_urls(image_urls)
                            image_url = image_urls[0] if image_urls else None
                            log_image_extraction("rightmove", title, len(image_urls))

                            # Extract description
                            description = _extract_description(card)

                            # Extract property type
                            property_type = _extract_property_type(card)

                            external_id, listing_url = _extract_external_id_and_url(
                                card, title=title, location=location_text
                            )

                            # Enrich images from the detail page (best-effort).
                            # Keep this additive: only override if we actually find a gallery.
                            if listing_url and len(image_urls) < 12:
                                try:
                                    detail_html = await _fetch_html(session, listing_url)
                                except Exception:
                                    detail_html = None
                                if detail_html:
                                    try:
                                        detail_imgs = _extract_rightmove_detail_image_urls(
                                            detail_html, listing_url
                                        )
                                        merged = normalize_image_urls([*detail_imgs, *image_urls])
                                        if merged:
                                            image_urls = merged
                                            image_url = merged[0]
                                    except Exception:
                                        pass

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
                                "imageurl": image_url,
                                "latitude": coords["latitude"],
                                "longitude": coords["longitude"],
                                "source": "rightmove",
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
                    # polite delay
                    await asyncio.sleep(RM_DELAY_MS / 1000.0)

            stats.log_summary()
            print(f"✅ Scraped {len(results)} Rightmove properties for '{location}'")
            run_log.set_count(len(results))
            return results
        except Exception as e:
            # Let RunLog handle the error in __exit__
            print(f"❌ Rightmove scraper error: {e}")
            raise


# Convenience wrapper matching previous signature (kept for backward compatibility)
async def scrape_rightmove_properties_default():
    return await scrape_rightmove_properties(location="London")


async def _fetch_api_properties(
    session: aiohttp.ClientSession, region_id: str, limit: int
) -> List[Dict[str, Any]]:
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
                raw = await resp.text()
                log_fetch_diagnostics(
                    "rightmove",
                    url,
                    status=resp.status,
                    text=raw,
                    via="direct-json",
                )

                if resp.status != 200:
                    # Production hosts frequently get blocked on this endpoint.
                    # If configured, retry through ScraperAPI for UK targeting consistency.
                    if not SCRAPERAPI_KEY:
                        break
                    try:
                        proxy_url = make_scraperapi_url(url, render=False)
                        async with session.get(proxy_url, headers=headers, timeout=60) as p_resp:
                            p_raw = await p_resp.text()
                            log_fetch_diagnostics(
                                "rightmove",
                                url,
                                status=p_resp.status,
                                text=p_raw,
                                via="scraperapi-json",
                            )
                            if p_resp.status != 200:
                                break
                            data = json.loads(p_raw)
                    except Exception:
                        break
                else:
                    try:
                        data = json.loads(raw)
                    except Exception:
                        break
        except Exception:
            break
        if not data or "properties" not in data:
            capture_debug_json(
                f"rightmove_api_empty_{index}",
                data if isinstance(data, dict) else {"raw": str(data)},
            )
            break
        props = data.get("properties", [])
        if not props:
            break
        for p in props:
            if len(out) >= limit:
                break
            try:
                property_id = str(
                    p.get("id")
                    or p.get("propertyId")
                    or p.get("identifier")
                    or p.get("listingId")
                    or ""
                )
                if not property_id:
                    continue
                title = (
                    p.get("displayAddress") or p.get("address") or p.get("summary") or "Untitled"
                )

                # Extract description from summary or propertySubType
                description = p.get("summary") or p.get("propertySubType") or None
                if description and isinstance(description, str) and len(description) > 20:
                    description = description.strip()
                else:
                    description = None

                # Extract property type from API data
                property_type_raw = p.get("propertySubType") or p.get("propertyType") or ""
                property_type = (
                    _normalize_property_type(property_type_raw) if property_type_raw else None
                )

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
