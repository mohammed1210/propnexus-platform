# backend/utils/ingest.py
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Tuple

from backend.scraper.onthemarket_scraper import scrape_onthemarket_properties
from backend.scraper.rightmove_scraper import scrape_rightmove_properties
from backend.scraper.spare_room_scraper import scrape_spareroom_properties
from backend.scraper.zoopla_scraper import scrape_zoopla_properties
from backend.utils.property_contract import normalize_property

POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", re.IGNORECASE)


def _extract_postcode(text: str | None) -> str | None:
    if not text:
        return None
    m = POSTCODE_RE.search(text)
    return m.group(1).upper().replace(" ", "") if m else None


def _canonical_url(source: str | None, external_id: str | None, raw_url: str | None) -> str | None:
    s = (source or "").lower()

    # Prefer scraper-provided URL if it's valid http(s)
    if raw_url and isinstance(raw_url, str) and raw_url.startswith(("http://", "https://")):
        return raw_url

    if not external_id:
        return None

    if s == "rightmove":
        return f"https://www.rightmove.co.uk/properties/{external_id}"
    if s == "zoopla":
        return f"https://www.zoopla.co.uk/for-sale/details/{external_id}"
    if s == "onthemarket":
        return f"https://www.onthemarket.com/details/{external_id}".rstrip("/")
    if s == "spareroom":
        return (
            f"https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id={external_id}"
        )
    return None


def _normalize_item(
    cleaned: Dict[str, Any], *, raw: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """
    Map *already-cleaned* scraper-shape output to properties table schema.

    Input (cleaned scraper-shape keys):
      external_id, title, location, price, bedrooms, bathrooms, description, property_type,
      image_url, image_urls, latitude, longitude, source, raw_url

    Output (DB-shape keys):
      external_id, title, description, price, bedrooms, bathrooms, property_type, address, postcode,
      latitude, longitude, source, url, image_urls, data
    """
    source = cleaned.get("source")
    external_id = cleaned.get("external_id")
    title = cleaned.get("title") or "Property"
    address = cleaned.get("location") or cleaned.get("address") or ""
    description = cleaned.get("description")
    price = cleaned.get("price")
    bedrooms = cleaned.get("bedrooms")
    bathrooms = cleaned.get("bathrooms")
    property_type = cleaned.get("property_type")
    lat = cleaned.get("latitude")
    lng = cleaned.get("longitude")
    raw_url = cleaned.get("raw_url") or cleaned.get("url")

    url = _canonical_url(
        str(source) if source else None,
        str(external_id) if external_id is not None else None,
        str(raw_url) if raw_url else None,
    )
    postcode = _extract_postcode(address)

    # DB image_urls is an array; normalize_property() already normalizes/dedupes.
    image_urls = cleaned.get("image_urls")
    if isinstance(image_urls, list) and not image_urls:
        image_urls = None

    out: Dict[str, Any] = {
        "external_id": external_id,
        "title": title,
        "description": description,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_type": property_type,
        "address": address,
        "postcode": postcode,
        "latitude": lat,
        "longitude": lng,
        "source": source,
        "url": url,
        "image_urls": image_urls,
        # Keep original raw payload for debugging/auditing
        "data": {"raw": raw or cleaned},
    }

    allowed = {
        "external_id",
        "title",
        "description",
        "price",
        "bedrooms",
        "bathrooms",
        "property_type",
        "address",
        "postcode",
        "latitude",
        "longitude",
        "source",
        "url",
        "image_urls",
        "data",
    }
    return {k: v for k, v in out.items() if k in allowed}


def _dedupe(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Dedupe by (source, external_id) primarily, then fallback on (title, price, address)."""
    seen: set[Tuple[Any, ...]] = set()
    out: List[Dict[str, Any]] = []
    for p in items:
        key: Tuple[Any, ...] = (p.get("source"), p.get("external_id"))
        if not key[1]:  # no external id
            key = (p.get("title"), p.get("price"), p.get("address"))
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


async def scrape_all_sources(location: str) -> List[Dict[str, Any]]:
    """
    Scrape from all sources and return normalized, deduped list for DB upsert.

    IMPORTANT:
    - Scraper-shape normalization is done ONCE here via normalize_property()
      (single choke point).
    - DB mapping is done after normalization via _normalize_item().
    """
    # Sequential to keep it simple and polite; can parallelize later if needed
    zp = await scrape_zoopla_properties(location)
    rm = await scrape_rightmove_properties(location)
    ot = await scrape_onthemarket_properties(location)
    sr = await scrape_spareroom_properties(location)

    merged_raw: List[Dict[str, Any]] = []
    for chunk in (zp or []), (rm or []), (ot or []), (sr or []):
        merged_raw.extend(list(chunk))

    # 1) Single choke point normalization (scraper-shape)
    cleaned_items: List[Dict[str, Any]] = []
    for raw in merged_raw:
        if not isinstance(raw, dict):
            continue
        cleaned = normalize_property(raw)
        cleaned_items.append({"cleaned": cleaned, "raw": raw})

    # 2) Map cleaned scraper-shape -> DB-shape
    normalized = [_normalize_item(w["cleaned"], raw=w["raw"]) for w in cleaned_items]

    # 3) Basic validation: ensure we can identify listing; require price > 0 only when present
    def _valid(p: Dict[str, Any]) -> bool:
        price = p.get("price")
        has_identity = bool(p.get("url") or (p.get("source") and p.get("external_id")))
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
