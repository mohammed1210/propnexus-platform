from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Tuple

# Scraper functions (async)
from scraper.rightmove_scraper import scrape_rightmove_properties
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.onthemarket_scraper import scrape_onthemarket_properties
from scraper.spare_room_scraper import scrape_spareroom_properties


POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", re.IGNORECASE)


def _extract_postcode(text: str | None) -> str | None:
    if not text:
        return None
    m = POSTCODE_RE.search(text)
    return m.group(1).upper().replace(" ", "") if m else None


def _canonical_url(source: str | None, external_id: str | None, raw_url: str | None) -> str | None:
    s = (source or "").lower()
    if raw_url:
        return raw_url
    if not external_id:
        return None
    if s == "rightmove":
        return f"https://www.rightmove.co.uk/properties/{external_id}"
    if s == "zoopla":
        return f"https://www.zoopla.co.uk/for-sale/details/{external_id}"
    if s == "onthemarket":
        # External id typically already includes numeric id; pattern can vary
        return f"https://www.onthemarket.com/details/{external_id}".rstrip("/")
    if s == "spareroom":
        return f"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id={external_id}"
    return None


def _normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Map scraper output to properties table schema.

    Expected input keys (best-effort):
      external_id, title, location, price, bedrooms, bathrooms, description, image_url, image_urls, latitude, longitude, source, raw_url

    Output keys:
      external_id, title, description, price, bedrooms, bathrooms, property_type, address, postcode,
      latitude, longitude, source, url, image_urls, data
    """
    source = item.get("source")
    external_id = item.get("external_id") or item.get("source_id")
    title = item.get("title") or "Property"
    location = item.get("location") or ""
    description = item.get("description")
    price = item.get("price")
    bedrooms = item.get("bedrooms")
    bathrooms = item.get("bathrooms")
    image_url = item.get("image_url") or item.get("imageurl")
    lat = item.get("latitude")
    lng = item.get("longitude")
    raw_url = item.get("raw_url") or item.get("url")

    url = _canonical_url(str(source) if source else None, str(external_id) if external_id else None, raw_url)
    postcode = _extract_postcode(location)

    # Handle image_urls array - combine from both sources
    image_urls: List[str] = []
    
    # Add images from image_urls array if present
    if "image_urls" in item and isinstance(item["image_urls"], list):
        for img in item["image_urls"]:
            if img and isinstance(img, str):
                image_urls.append(img)
    
    # Add single image_url if present and not already in list
    if isinstance(image_url, str) and image_url:
        if image_url not in image_urls:
            image_urls.insert(0, image_url)  # Put as first image

    out = {
        "external_id": external_id,
        "title": title,
        "description": description,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_type": None,
        "address": location,
        "postcode": postcode,
        "latitude": lat,
        "longitude": lng,
        "source": source,
        "url": url,
        "image_urls": image_urls if image_urls else None,
        "data": {"raw": item},
    }
    # Remove keys not present in schema to avoid PostgREST errors
    # (Schema currently excludes 'address' if the error is due to cache mismatch, fallback.)
    # Validate against known columns list
    allowed = {
        "external_id","title","description","price","bedrooms","bathrooms","property_type",
        "address","postcode","latitude","longitude","source","url","image_urls","data"
    }
    return {k: v for k, v in out.items() if k in allowed}


def _dedupe(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Dedupe by (source, external_id) primarily, then fallback on (title, price, address)."""
    seen: set[Tuple[Any, Any]] = set()
    out: List[Dict[str, Any]] = []
    for p in items:
        key = (p.get("source"), p.get("external_id"))
        if not key[1]:  # no external id
            key = (p.get("title"), p.get("price"), p.get("address"))
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


async def scrape_all_sources(location: str) -> List[Dict[str, Any]]:
    """Scrape from all sources and return normalized, deduped list for upsert."""
    # Sequential to keep it simple and polite; can parallelize later if needed
    zp = await scrape_zoopla_properties(location)
    rm = await scrape_rightmove_properties(location)
    ot = await scrape_onthemarket_properties(location)
    sr = await scrape_spareroom_properties(location)

    merged_raw = []
    for chunk in (zp or []), (rm or []), (ot or []), (sr or []):
        merged_raw.extend(list(chunk))

    normalized = [_normalize_item(i) for i in merged_raw]

    # Basic validation: ensure price is a positive int and we have a url or external_id
    def _valid(p: Dict[str, Any]) -> bool:
        price = p.get("price")
        has_identity = bool(p.get("url") or (p.get("source") and p.get("external_id")))
        # Accept if we can identify the listing; require price > 0 only when present
        if not has_identity:
            return False
        if price is None:
            return True
        try:
            return isinstance(price, (int, float)) and int(price) > 0
        except Exception:
            return False

    filtered = [p for p in normalized if _valid(p)]
    return _dedupe(filtered)
