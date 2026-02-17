import asyncio
import hashlib
import inspect
import json
import os
import random
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urljoin

import aiohttp
from bs4 import BeautifulSoup
from fastapi import BackgroundTasks

from backend.scraper.utils import normalize_image_urls
from backend.utils.image_utils import dedupe_image_urls, pick_cover_image
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
from backend.utils.scraperapi_client import fetch_via_scraperapi
from backend.utils.validation import clean_property_data, should_insert_property

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

# Bump this when listing/detail selectors materially change.
SELECTOR_VERSION = "v1"

SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()
SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY", "").strip()
ZP_MAX_PAGES = int(os.getenv("ZP_MAX_PAGES", "1"))
ZP_DELAY_MS = int(os.getenv("ZP_DELAY_MS", "900"))
SCRAPERAPI_BASE = "https://api.scraperapi.com/"

CAPTCHA_KEYWORDS = ["captcha", "access denied", "unusual traffic"]


def _pick_best_from_srcset(srcset: str) -> Optional[str]:
    """Pick the highest-width URL from a srcset string."""
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


def _extract_zoopla_gallery_image_urls(html: str, page_url: str) -> List[str]:
    """Extract gallery (non-thumbnail where possible) image URLs from a Zoopla detail page."""
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    candidates: List[str] = []

    # 1) Common gallery/carousel containers (best-effort selectors).
    try:
        for el in soup.select(
            "[data-testid*='gallery'] img, [data-testid*='carousel'] img, [class*='gallery'] img, [class*='carousel'] img"
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

    # 2) Any picture/source srcset (often contains higher-res URLs).
    try:
        for el in soup.select("source[srcset], img[srcset]"):
            srcset = el.get("srcset")
            if isinstance(srcset, str) and srcset.strip():
                best = _pick_best_from_srcset(srcset)
                if best:
                    candidates.append(urljoin(page_url, best))
    except Exception:
        pass

    # 3) Embedded Next.js payloads can include full image arrays.
    try:
        next_data = _extract_next_data(soup) or _extract_next_data_from_html(html)
    except Exception:
        next_data = None

    if isinstance(next_data, dict):

        def _scan(obj: Any, depth: int = 0) -> None:
            if depth > 12:
                return
            if isinstance(obj, str):
                s = obj.strip()
                if not s:
                    return
                # Restrict to plausible Zoopla image URLs to avoid dragging in unrelated assets.
                sl = s.lower()
                if (
                    ("zoocdn" in sl)
                    or ("zoopla" in sl)
                    or sl.startswith("http")
                    or sl.startswith("//")
                ):
                    candidates.append(urljoin(page_url, s))
                return
            if isinstance(obj, dict):
                for k, v in obj.items():
                    kl = str(k).lower()
                    if kl in ("image", "imageurl", "imageurls", "images", "photos", "gallery"):
                        _scan(v, depth + 1)
                        continue
                    # Common nested URL fields.
                    if kl in ("url", "src", "original", "originalurl", "full", "large"):
                        _scan(v, depth + 1)
                        continue
                    _scan(v, depth + 1)
                return
            if isinstance(obj, list):
                for v in obj:
                    _scan(v, depth + 1)

        _scan(next_data)

    return normalize_image_urls(candidates)


def _allow_parse_despite_block(text: str, status: int, url: str) -> bool:
    """Heuristic escape hatch.

    In ScraperAPI mode, Zoopla responses can trip keyword-based blocking checks
    while still containing perfectly parseable HTML (cards, __NEXT_DATA__, or
    detail links). The probe endpoint uses a "cards beat heuristics" approach;
    this helper brings the fetch layer in line by allowing parsing of large,
    200-OK documents that look like real Zoopla pages.
    """

    try:
        if int(status) != 200:
            return False
    except Exception:
        return False

    if not (text or "").strip():
        return False
    if len(text) < 50_000:
        return False

    if _is_detail_url(url):
        return True

    lowered = (text or "").lower()
    # Listings/search pages should contain either detail links or Next.js payload.
    if "/for-sale/details/" in lowered:
        return True
    if "__next_data__" in lowered:
        return True
    return False


def _is_detail_url(url: str) -> bool:
    return bool(url and isinstance(url, str) and "/for-sale/details/" in url)


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
        listing_url = d.get("listingUrl") or d.get("url")
        if not listing_url:
            listing_url = f"https://www.zoopla.co.uk/for-sale/details/{external_id}/"

        # Normalize and de-dupe images now that we know the base URL.
        image_urls = normalize_image_urls(
            [urljoin(listing_url, u) for u in image_urls if isinstance(u, str)]
        )
        image_url = image_urls[0] if image_urls else None

        loc_text = d.get("displayAddress") or d.get("address") or str(title)
        lat = None
        lng = None
        geo = d.get("location") or d.get("geo") or {}
        if isinstance(geo, dict):
            lat = geo.get("latitude") or geo.get("lat")
            lng = geo.get("longitude") or geo.get("lng")

        lat_f = float(lat) if isinstance(lat, (int, float)) else None
        lng_f = float(lng) if isinstance(lng, (int, float)) else None
        if lat_f == 0.0:
            lat_f = None
        if lng_f == 0.0:
            lng_f = None

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
            "imageurl": image_url,
            "latitude": lat_f,
            "longitude": lng_f,
            "source": "zoopla",
            "raw_url": listing_url,
            "listing_url": listing_url,
        }
    except Exception:
        return None


_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)


_DETAIL_ID_RE = re.compile(r"/for-sale/details/(?P<id>\d+)")


def _looks_like_postcode(s: str) -> bool:
    return bool(s and _POSTCODE_RE.search(s))


def _extract_external_id_from_detail_url(url: str) -> Optional[str]:
    if not url or not isinstance(url, str):
        return None
    m = _DETAIL_ID_RE.search(url)
    return m.group("id") if m else None


def _collect_detail_listing_urls(soup: BeautifulSoup) -> List[str]:
    """Collect Zoopla detail URLs from a search results page.

    When Zoopla changes DOM structure, card selectors can fail while detail links
    remain stable.
    """

    urls: List[str] = []
    seen: set[str] = set()
    for a in soup.select("a[href*='/for-sale/details/']"):
        href = a.get("href")
        if not href or not isinstance(href, str):
            continue
        u = href
        if u.startswith("//"):
            u = "https:" + u
        elif u.startswith("/"):
            u = "https://www.zoopla.co.uk" + u
        if not u.startswith("http"):
            continue
        # Only keep URLs we can extract a numeric id from.
        if not _extract_external_id_from_detail_url(u):
            continue
        if u not in seen:
            seen.add(u)
            urls.append(u)
    return urls


def _parse_zoopla_detail_page(html: str, url: str) -> Optional[Dict[str, Any]]:
    """Best-effort parse of a Zoopla detail page.

    Goal: extract enough fields to pass `should_insert_property` (external_id,
    title, source, and either price or location) and provide a usable image.
    """

    external_id = _extract_external_id_from_detail_url(url)
    if not external_id:
        return None

    soup = BeautifulSoup(html or "", "html.parser")

    # 1) Try JSON-LD structured data.
    title = None
    location = None
    price = None
    latitude = 0.0
    longitude = 0.0
    image_urls: List[str] = []
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None

    def _norm_url(u: str) -> str:
        u = (u or "").strip()
        if u.startswith("//"):
            return "https:" + u
        if u.startswith("/"):
            return "https://www.zoopla.co.uk" + u
        return u

    def _iter_jsonld_objects(obj: Any):
        if isinstance(obj, dict):
            yield obj
            for v in obj.values():
                yield from _iter_jsonld_objects(v)
        elif isinstance(obj, list):
            for v in obj:
                yield from _iter_jsonld_objects(v)

    try:
        for el in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = (el.string or el.get_text() or "").strip()
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue

            for o in _iter_jsonld_objects(data):
                # Look for an object with offers/price and an address/name.
                offers = o.get("offers") if isinstance(o, dict) else None
                addr = o.get("address") if isinstance(o, dict) else None
                name = o.get("name") if isinstance(o, dict) else None
                if not (offers or addr or name):
                    continue

                if not title and isinstance(name, str) and name.strip():
                    title = name.strip()

                if not location:
                    if isinstance(addr, str) and addr.strip():
                        location = addr.strip()
                    elif isinstance(addr, dict):
                        parts = [
                            addr.get("streetAddress"),
                            addr.get("addressLocality"),
                            addr.get("postalCode"),
                        ]
                        parts = [p.strip() for p in parts if isinstance(p, str) and p.strip()]
                        if parts:
                            location = ", ".join(parts)

                if price is None and offers is not None:
                    cand = None
                    if isinstance(offers, dict):
                        cand = offers.get("price")
                        if cand is None and isinstance(offers.get("priceSpecification"), dict):
                            cand = offers["priceSpecification"].get("price")
                    elif isinstance(offers, list) and offers and isinstance(offers[0], dict):
                        cand = offers[0].get("price")
                    if cand is not None:
                        try:
                            price = int(str(cand).replace(",", "").strip())
                        except Exception:
                            price = _parse_price(str(cand))

                if not image_urls:
                    img = o.get("image") if isinstance(o, dict) else None
                    if isinstance(img, str):
                        image_urls = [_norm_url(img)]
                    elif isinstance(img, list):
                        image_urls = [_norm_url(x) for x in img if isinstance(x, str) and x.strip()]

                geo = o.get("geo") if isinstance(o, dict) else None
                if isinstance(geo, dict):
                    lat = geo.get("latitude")
                    lng = geo.get("longitude")
                    try:
                        if lat is not None:
                            latitude = float(lat)
                        if lng is not None:
                            longitude = float(lng)
                    except Exception:
                        pass

            # If we got the core fields, no need to keep scanning.
            if title and (price is not None or location) and image_urls:
                break
    except Exception:
        pass

    # 2) Fallback to meta tags / title text.
    if not title:
        try:
            og_title = soup.find("meta", attrs={"property": "og:title"})
            if og_title and og_title.get("content"):
                title = str(og_title.get("content")).strip() or None
        except Exception:
            title = None
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True) or None

    # If we still don't have a location, use title as a last-resort proxy.
    # This is sufficient for should_insert_property (price OR location).
    if not location and title:
        location = title

    # If we still don't have a price, try parsing it from the title.
    if price is None and title:
        m = re.search(r"£\s*\d[\d,]*", title)
        if m:
            price = _parse_price(m.group(0))
        else:
            price = _parse_price(title)

    if price is None:
        try:
            og_desc = soup.find("meta", attrs={"property": "og:description"})
            if og_desc and og_desc.get("content"):
                price = _parse_price(str(og_desc.get("content")))
        except Exception:
            pass

    # Last-resort: search body text for a currency value.
    if price is None:
        try:
            body_text = soup.get_text(" ", strip=True)
            m = re.search(r"£\s*\d[\d,]*", body_text)
            if m:
                price = _parse_price(m.group(0))
        except Exception:
            pass

    if not image_urls:
        try:
            og_img = soup.find("meta", attrs={"property": "og:image"})
            if og_img and og_img.get("content"):
                image_urls = [_norm_url(str(og_img.get("content")))]
        except Exception:
            pass

    # Additional image sources: preload links and srcset.
    if len(image_urls) < 2:
        try:
            for link in soup.find_all("link", attrs={"rel": "preload"}):
                if (link.get("as") or "").lower() != "image":
                    continue
                href = link.get("href")
                if href and isinstance(href, str):
                    image_urls.append(_norm_url(href))
        except Exception:
            pass

    # Gallery / carousel images from the detail page (best-effort).
    try:
        gallery_urls = _extract_zoopla_gallery_image_urls(html, url)
        if gallery_urls:
            image_urls.extend(gallery_urls)
    except Exception:
        pass

    if len(image_urls) < 2:
        try:
            for img in soup.select("img[src], img[srcset], source[srcset]"):
                cand = img.get("src") or None
                if not cand:
                    srcset = img.get("srcset") or ""
                    if isinstance(srcset, str) and srcset.strip():
                        cand = srcset.split(",")[0].strip().split(" ")[0].strip()
                if cand and isinstance(cand, str):
                    image_urls.append(_norm_url(cand))
                if len(image_urls) >= 6:
                    break
        except Exception:
            pass

    # Bedrooms/bathrooms best-effort from body text.
    try:
        body_text = soup.get_text(" ", strip=True)
        m_bed = re.search(r"\b(\d{1,2})\s*(?:bed|beds|bedroom|bedrooms)\b", body_text, re.I)
        if m_bed:
            bedrooms = int(m_bed.group(1))
        m_bath = re.search(r"\b(\d{1,2})\s*(?:bath|baths|bathroom|bathrooms)\b", body_text, re.I)
        if m_bath:
            bathrooms = int(m_bath.group(1))
    except Exception:
        pass

    image_urls = normalize_image_urls([urljoin(url, u) for u in image_urls if isinstance(u, str)])
    try:
        image_urls = dedupe_image_urls(image_urls, base_url=url)
    except Exception:
        pass
    image_url = pick_cover_image(image_urls) if image_urls else None

    return {
        "external_id": external_id,
        "title": title or f"Zoopla listing {external_id}",
        "location": location,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_type": None,
        "image_url": image_url,
        "image_urls": image_urls,
        "imageurl": image_url,
        "latitude": latitude,
        "longitude": longitude,
        "source": "zoopla",
        "raw_url": url,
        "listing_url": url,
    }


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

    # For Zoopla detail pages, ScraperAPI render=true can sometimes return less
    # parseable HTML than the non-rendered response. Prefer render=false.
    render_js = not _is_detail_url(url)

    # Determine which URL to fetch based on SCRAPER_MODE
    mode = os.getenv("SCRAPER_MODE", "direct").lower()

    if mode == "scraperapi" and SCRAPERAPI_KEY:
        # Zoopla is consistently protected; always use premium=true and allow a single
        # escalation to ultra_premium=true on 5xx/empty.
        try:
            r = await fetch_via_scraperapi(
                session,
                url,
                headers=headers,
                country_code="gb",
                render=render_js,
                premium=True,
                ultra_premium=False,
                timeout_seconds=120,
                debug_label="zoopla",
            )
            text = r.text
            status = int(r.status)
            log_fetch_diagnostics(
                "zoopla",
                url,
                status=status,
                text=text,
                via="scraperapi-ultra" if r.ultra_premium else "scraperapi-premium",
            )

            blocked = (
                _looks_blocked(text, status)
                or _has_cloudflare_marker(text)
                or not (text or "").strip()
            )
            if blocked and not _allow_parse_despite_block(text, status, url):
                return None
            return text
        except Exception as e:
            print(f"⚠️ [zoopla] ScraperAPI fetch failed: {e}")
            return None

    # Direct mode (or no key): use origin fetch then fallback to ScraperAPI if blocked.
    url_to_fetch = url

    # Fetch the URL (either direct or via ScraperAPI)
    try:
        req = session.get(url_to_fetch, headers=headers, timeout=30)
        if inspect.isawaitable(req):
            req = await req
        async with req as resp:
            text = await resp.text()
            log_fetch_diagnostics(
                "zoopla",
                url,
                status=resp.status,
                text=text,
                via="direct",
            )

            # If origin 5xx, treat as failure; fallback to ScraperAPI if available.
            if 500 <= int(resp.status) <= 599:
                if not SCRAPERAPI_KEY:
                    return None
                try:
                    r = await fetch_via_scraperapi(
                        session,
                        url,
                        headers=headers,
                        country_code="gb",
                        render=render_js,
                        premium=True,
                        ultra_premium=False,
                        timeout_seconds=120,
                        debug_label="zoopla",
                    )
                    log_fetch_diagnostics(
                        "zoopla",
                        url,
                        status=r.status,
                        text=r.text,
                        via="scraperapi-ultra" if r.ultra_premium else "scraperapi-premium",
                    )
                    blocked_proxy = (
                        _looks_blocked(r.text, int(r.status))
                        or _has_cloudflare_marker(r.text)
                        or not (r.text or "").strip()
                    )
                    if blocked_proxy and not _allow_parse_despite_block(r.text, int(r.status), url):
                        return None
                    return r.text
                except Exception:
                    return None

            blocked = (
                _looks_blocked(text, resp.status)
                or _has_cloudflare_marker(text)
                or not (text or "").strip()
            )

            # If direct mode and we detect blocking, try ScraperAPI as fallback
            if mode == "direct" and blocked and SCRAPERAPI_KEY:
                log_scraperapi_fallback("zoopla", url)
                print(f"ℹ️ Fallback to ScraperAPI for blocked URL: {url}")
                try:
                    r = await fetch_via_scraperapi(
                        session,
                        url,
                        headers=headers,
                        country_code="gb",
                        render=render_js,
                        premium=True,
                        ultra_premium=False,
                        timeout_seconds=120,
                        debug_label="zoopla",
                    )
                    log_fetch_diagnostics(
                        "zoopla",
                        url,
                        status=r.status,
                        text=r.text,
                        via="scraperapi-ultra" if r.ultra_premium else "scraperapi-premium",
                    )
                    blocked_proxy = (
                        _looks_blocked(r.text, int(r.status))
                        or _has_cloudflare_marker(r.text)
                        or not (r.text or "").strip()
                    )
                    if blocked_proxy and not _allow_parse_despite_block(r.text, int(r.status), url):
                        return None
                    return r.text
                except Exception:
                    return None

            # If still looks blocked, return None.
            # Exception: for Zoopla detail pages, return the HTML anyway so the
            # parser can attempt JSON-LD/og:* extraction even when heuristics are noisy.
            if blocked:
                if _allow_parse_despite_block(text, int(resp.status), url):
                    return text
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
                proxy_url = make_scraperapi_url(url, render=render_js)
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
                    if not blocked_proxy or _allow_parse_despite_block(
                        p_text, int(p_resp.status), url
                    ):
                        return p_text

                    premium_url = make_scraperapi_url(
                        url,
                        render=render_js,
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
                        if blocked_premium:
                            if _allow_parse_despite_block(pp_text, int(pp_resp.status), url):
                                return pp_text
                            return None
                        return pp_text
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

    # Fallback: Zoopla markup changes can break the selector list above.
    # If we can find detail links, treat their nearest container as a card.
    if not cards:
        try:
            detail_links = soup.select("a[href*='/for-sale/details/']")
            for a in detail_links:
                # Walk up to a reasonable container.
                container = a
                for _ in range(0, 8):
                    parent = getattr(container, "parent", None)
                    if not parent:
                        break
                    container = parent
                    tag = getattr(container, "name", "")
                    if tag in ("article", "li"):
                        cards.append(container)
                        break
                    attrs = getattr(container, "attrs", {}) or {}
                    dt = attrs.get("data-testid")
                    if dt and isinstance(dt, str) and "search" in dt and "result" in dt:
                        cards.append(container)
                        break
        except Exception:
            pass
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
    location: str,
    limit: int = 40,
    background_tasks: BackgroundTasks | None = None,
    *,
    max_pages: int | None = None,
) -> List[Dict[str, Any]]:
    log_scrape_start("zoopla", location, SCRAPER_MODE)
    stats = ScraperStats("zoopla", location)
    results: List[Dict[str, Any]] = []

    # Start audit logging
    with RunLog.start(source="zoopla", mode=SCRAPER_MODE, location=location) as run_log:
        try:
            effective_max_pages = (
                int(max_pages)
                if max_pages is not None
                else int(os.getenv("ZP_MAX_PAGES", str(ZP_MAX_PAGES)))
            )
            effective_max_pages = max(1, min(5, int(effective_max_pages)))
            async with aiohttp.ClientSession() as session:
                for page in range(effective_max_pages):
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
                    page_results_before = len(results)
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
                                # Best-effort enrich with gallery images from each detail page.
                                max_details = min(len(results), max(3, min(8, limit)))
                                for item in results[:max_details]:
                                    try:
                                        detail_url = item.get("listing_url") or item.get("raw_url")
                                        if (
                                            not isinstance(detail_url, str)
                                            or not detail_url.strip()
                                        ):
                                            continue
                                        if (
                                            isinstance(item.get("image_urls"), list)
                                            and len(item["image_urls"]) >= 12
                                        ):
                                            continue
                                        try:
                                            detail_html = await _fetch_html(session, detail_url)
                                        except Exception:
                                            detail_html = None
                                        if not detail_html:
                                            continue
                                        detail_imgs = _extract_zoopla_gallery_image_urls(
                                            detail_html, detail_url
                                        )
                                        existing = item.get("image_urls")
                                        existing_list = (
                                            existing if isinstance(existing, list) else []
                                        )
                                        merged = normalize_image_urls(
                                            [*detail_imgs, *existing_list]
                                        )
                                        if merged:
                                            item["image_urls"] = merged
                                            item["image_url"] = merged[0]
                                            item["imageurl"] = merged[0]
                                    except Exception:
                                        continue

                                stats.log_summary()
                                print(
                                    f"✅ Zoopla embedded JSON returned {len(results)} properties for '{location}'"
                                )
                                run_log.set_count(len(results))
                                return results

                        # Fallback: if DOM selectors and embedded JSON both fail,
                        # try extracting detail page links and parsing each detail page.
                        detail_urls = _collect_detail_listing_urls(soup)
                        if detail_urls:
                            max_details = min(len(detail_urls), max(3, min(12, limit)))
                            for detail_url in detail_urls[:max_details]:
                                if len(results) >= limit:
                                    break
                                try:
                                    detail_html = await _fetch_html(session, detail_url)
                                except Exception:
                                    detail_html = None
                                if not detail_html:
                                    continue

                                parsed = _parse_zoopla_detail_page(detail_html, detail_url)
                                if not parsed:
                                    continue
                                if not parsed.get("location"):
                                    parsed["location"] = location
                                should_insert, reason = should_insert_property(parsed)
                                if should_insert:
                                    results.append(clean_property_data(parsed))
                                    stats.log_parse_success()
                                else:
                                    stats.log_validation_failure(reason or "Unknown")

                            if results:
                                stats.log_summary()
                                print(
                                    f"✅ Zoopla detail-page fallback returned {len(results)} properties for '{location}'"
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
                            image_urls = normalize_image_urls(image_urls)
                            image_url = image_urls[0] if image_urls else None
                            log_image_extraction("zoopla", title, len(image_urls))

                            # Extract description
                            description = _extract_description(card)

                            # Extract property type
                            property_type = _extract_property_type(card)

                            external_id, listing_url = _extract_external_id_and_url(card)

                            # Enrich images from the detail page (best-effort).
                            # Keep this additive: only override if we actually find a gallery.
                            if listing_url and len(image_urls) < 12:
                                try:
                                    detail_html = await _fetch_html(session, listing_url)
                                except Exception:
                                    detail_html = None
                                if detail_html:
                                    try:
                                        detail_imgs = _extract_zoopla_gallery_image_urls(
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

                    # If we detected cards (often via link-container fallback) but none
                    # were valid enough to insert, try the same embedded/detail fallbacks
                    # as the no-cards path.
                    if cards and len(results) == page_results_before:
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

                        detail_urls = _collect_detail_listing_urls(soup)
                        if detail_urls:
                            max_details = min(len(detail_urls), max(3, min(12, limit)))
                            for detail_url in detail_urls[:max_details]:
                                if len(results) >= limit:
                                    break
                                try:
                                    detail_html = await _fetch_html(session, detail_url)
                                except Exception:
                                    detail_html = None
                                if not detail_html:
                                    continue

                                parsed = _parse_zoopla_detail_page(detail_html, detail_url)
                                if not parsed:
                                    continue
                                if not parsed.get("location"):
                                    parsed["location"] = location
                                should_insert, reason = should_insert_property(parsed)
                                if should_insert:
                                    results.append(clean_property_data(parsed))
                                    stats.log_parse_success()
                                else:
                                    stats.log_validation_failure(reason or "Unknown")

                            if results:
                                stats.log_summary()
                                print(
                                    f"✅ Zoopla detail-page fallback returned {len(results)} properties for '{location}'"
                                )
                                run_log.set_count(len(results))
                                return results
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
