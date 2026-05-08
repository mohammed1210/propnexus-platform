from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from statistics import mean, median
from typing import Any, Dict, List, Optional

from backend.utils.enrichment import fetch_crime_police_uk, geocode_postcode
from backend.utils.enrichment_store import is_fresh, safe_select_ppd_sales
from backend.utils.listing_keys import extract_postcode
from backend.utils.supabase_client import get_supabase

_FULL_POSTCODE_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$", re.I)
_OUTWARD_RE = re.compile(r"^[A-Z]{1,2}\d{1,2}[A-Z]?$", re.I)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _utcnow().isoformat()


def _ttl_hours(name: str, default: int = 168) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except Exception:
        return default


def _normalise_key(value: str | None) -> str:
    raw = (value or "").strip().upper()
    if not raw:
        return ""
    extracted = extract_postcode(raw) or raw
    return re.sub(r"\s+", " ", extracted.strip().upper())


def _outward_code(value: str | None) -> str:
    key = _normalise_key(value)
    if not key:
        return ""
    if " " in key:
        return key.split()[0]
    compact = re.sub(r"\s+", "", key)
    # Compact full postcodes: last three chars are inward code.
    if len(compact) >= 5 and re.search(r"\d[A-Z]{2}$", compact):
        outward = compact[:-3]
        if _OUTWARD_RE.match(outward):
            return outward
    if _FULL_POSTCODE_RE.match(key):
        return key.split()[0]
    return compact


def _is_full_postcode(value: str | None) -> bool:
    key = _normalise_key(value)
    if not key:
        return False
    if _FULL_POSTCODE_RE.match(key):
        return True
    compact = re.sub(r"\s+", "", key)
    return bool(re.match(r"^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$", compact, re.I))


def _full_postcode(value: str | None) -> str:
    key = _normalise_key(value)
    if not key:
        return ""
    if _FULL_POSTCODE_RE.match(key) and " " in key:
        outward, inward = key.split()
        return f"{outward} {inward}"
    compact = re.sub(r"\s+", "", key)
    if len(compact) >= 5 and re.match(r"^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$", compact, re.I):
        return f"{compact[:-3]} {compact[-3:]}"
    return ""


def _postcode_sector(value: str | None) -> str:
    full = _full_postcode(value)
    if not full:
        return ""
    outward, inward = full.split()
    return f"{outward} {inward[0]}"


def _num(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        out = float(value)
    except Exception:
        return None
    return out if out == out and out > 0 else None


def _run(coro: Any) -> Any:
    try:
        return asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


def _get_cache(
    sb: Any, table: str, key_col: str, key: str, ttl_hours: int
) -> Optional[Dict[str, Any]]:
    if not sb or not key:
        return None
    try:
        res = sb.table(table).select("*").eq(key_col, key).limit(1).maybe_single().execute()
        row = res.data if isinstance(res.data, dict) else None
        if not row or not is_fresh(fetched_at=row.get("fetched_at"), ttl_hours=ttl_hours):
            return None
        payload = row.get("payload")
        if isinstance(payload, dict):
            out = dict(payload)
            out["source"] = "cache"
            out.setdefault("source_details", {})
            out["is_cached"] = True
            return out
    except Exception:
        return None
    return None


def _set_cache(sb: Any, table: str, key_col: str, key: str, payload: Dict[str, Any]) -> None:
    if not sb or not key or not isinstance(payload, dict):
        return
    try:
        row = {
            key_col: key,
            "payload": payload,
            "source": payload.get("source") or "partial_live",
            "fetched_at": payload.get("fetched_at") or _iso_now(),
        }
        sb.table(table).upsert(row).execute()
    except Exception:
        return


def _format_ppd_address(row: Dict[str, Any]) -> str:
    parts = [row.get("saon"), row.get("paon"), row.get("street"), row.get("town_city")]
    text = ", ".join(str(p).strip() for p in parts if str(p or "").strip())
    return text or str(row.get("postcode") or "Sold property")


def _sold_comps(sb: Any, key: str, outward: str, *, limit: int = 8) -> List[Dict[str, Any]]:
    if not sb or not outward:
        return []

    search_specs: list[tuple[str, str]] = []
    full = _full_postcode(key)
    sector = _postcode_sector(key)
    if full:
        search_specs.append(("exact", full))
    if sector:
        search_specs.append(("sector", sector))
    search_specs.append(("outward", outward))

    comps: List[Dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for match_level, postcode_filter in search_specs:
        rows = safe_select_ppd_sales(
            sb,
            postcode_prefix=postcode_filter,
            limit=limit,
            months_back=36,
            match_mode=match_level,
        )
        for row in rows:
            if not isinstance(row, dict):
                continue
            price = _num(row.get("price"))
            if not price:
                continue
            dedupe_key = (
                row.get("postcode"),
                row.get("price"),
                row.get("date_of_transfer"),
                row.get("paon"),
                row.get("saon"),
                row.get("street"),
            )
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            comps.append(
                {
                    "address": _format_ppd_address(row),
                    "price": int(price),
                    "date": row.get("date_of_transfer"),
                    "type": row.get("property_type"),
                    "property_type": row.get("property_type"),
                    "tenure": row.get("tenure"),
                    "postcode": row.get("postcode"),
                    "distance_km": row.get("distance_km"),
                    "source": "land_registry_ppd",
                    "match_level": match_level,
                }
            )
            if len(comps) >= limit:
                return comps
    return comps


def _extract_rent(row: Dict[str, Any]) -> Optional[float]:
    for key in ("rent_monthly", "rent_pcm", "monthly_rent", "pcm"):
        val = _num(row.get(key))
        if val:
            return val
    data = row.get("data") if isinstance(row.get("data"), dict) else {}
    for key in ("rent_monthly", "rent_pcm", "monthly_rent", "pcm", "rent"):
        val = _num(data.get(key))
        if val:
            return val
    score = (
        row.get("score_breakdown")
        if isinstance(row.get("score_breakdown"), dict)
        else data.get("score_breakdown")
    )
    inputs = (
        score.get("inputs")
        if isinstance(score, dict) and isinstance(score.get("inputs"), dict)
        else {}
    )
    return _num(inputs.get("rent_monthly"))


def _rental_comps(sb: Any, outward: str, *, limit: int = 8) -> List[Dict[str, Any]]:
    if not sb or not outward:
        return []
    try:
        res = (
            sb.table("properties")
            .select(
                "id,title,address,location,postcode,price,bedrooms,property_type,url,data,created_at,updated_at"
            )
            .ilike("postcode", f"{outward}%")
            .limit(80)
            .execute()
        )
        rows = res.data if isinstance(res.data, list) else []
    except Exception:
        return []

    comps: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rent = _extract_rent(row)
        if not rent:
            continue
        comps.append(
            {
                "address": row.get("address")
                or row.get("title")
                or row.get("location")
                or row.get("postcode"),
                "title": row.get("title"),
                "price": round(float(rent), 2),
                "rent_monthly": round(float(rent), 2),
                "date": row.get("updated_at") or row.get("created_at"),
                "type": row.get("property_type"),
                "property_type": row.get("property_type"),
                "bedrooms": row.get("bedrooms"),
                "source_url": row.get("url"),
                "distance_km": None,
                "source": "internal_property_listings",
            }
        )
        if len(comps) >= limit:
            break
    return comps


def _geocode_with_cache(
    sb: Any, key: str
) -> tuple[Optional[float], Optional[float], Optional[Dict[str, Any]], str]:
    if not _is_full_postcode(key):
        return None, None, None, "not_available"
    postcode = _normalise_key(key)
    if sb:
        try:
            res = (
                sb.table("postcode_geo_cache")
                .select("*")
                .eq("postcode", postcode)
                .limit(1)
                .maybe_single()
                .execute()
            )
            row = res.data if isinstance(res.data, dict) else None
            if row and is_fresh(
                fetched_at=row.get("fetched_at"), ttl_hours=_ttl_hours("AREA_INTEL_TTL_HOURS")
            ):
                lat = _num(row.get("latitude"))
                lng = _num(row.get("longitude"))
                if lat and lng:
                    return (
                        lat,
                        lng,
                        row.get("raw") if isinstance(row.get("raw"), dict) else None,
                        row.get("source") or "postcodes.io",
                    )
        except Exception:
            pass

    try:
        lat, lng, raw, source = _run(geocode_postcode(postcode))
        if sb and lat is not None and lng is not None:
            try:
                sb.table("postcode_geo_cache").upsert(
                    {
                        "postcode": postcode,
                        "latitude": lat,
                        "longitude": lng,
                        "source": source,
                        "raw": raw,
                        "fetched_at": _iso_now(),
                    }
                ).execute()
            except Exception:
                pass
        return lat, lng, raw, source
    except Exception:
        return None, None, None, "postcodes.io_error"


def _crime_summary(lat: Optional[float], lng: Optional[float]) -> Optional[Dict[str, Any]]:
    if os.getenv("CRIME_ENABLE", "1").strip().lower() in {"0", "false", "off", "no"}:
        return None
    if lat is None or lng is None:
        return None
    try:
        crime = _run(fetch_crime_police_uk(latitude=lat, longitude=lng))
        if isinstance(crime, dict) and crime.get("count") is not None:
            return {
                "count": int(crime.get("count") or 0),
                "month": crime.get("month"),
                "source": "police.uk",
            }
    except Exception:
        return None
    return None


def get_comps_from_provider(postcode: str) -> dict:
    key = _normalise_key(postcode)
    outward = _outward_code(key)
    fetched_at = _iso_now()
    sb = get_supabase(required=False)
    cache_key = _full_postcode(key) or outward or key
    cached = _get_cache(sb, "comps_cache", "postcode", cache_key, _ttl_hours("COMPS_TTL_HOURS"))
    if cached:
        return cached

    sales = _sold_comps(sb, key, outward)
    rents = _rental_comps(sb, outward)
    sales_match_level = sales[0].get("match_level") if sales else None
    payload = {
        "postcode": key or outward,
        "outward_code": outward or None,
        "sales": sales,
        "rents": rents,
        "source": "partial_live" if sales or rents else "unavailable",
        "source_details": {
            "sales": "land_registry_ppd" if sales else "not_available",
            "sales_match_level": sales_match_level,
            "rent": "internal_property_listings" if rents else "not_available",
        },
        "confidence": "medium" if sales or rents else "none",
        "is_live": bool(sales or rents),
        "is_proxy": False,
        "fetched_at": fetched_at,
    }
    _set_cache(sb, "comps_cache", "postcode", cache_key, payload)
    return payload


def get_area_intel_from_provider(key: str) -> dict:
    normalised = _normalise_key(key)
    outward = _outward_code(normalised)
    fetched_at = _iso_now()
    sb = get_supabase(required=False)
    cache_key = _full_postcode(normalised) or outward or normalised
    cached = _get_cache(
        sb, "area_intel_cache", "key", cache_key, _ttl_hours("AREA_INTEL_TTL_HOURS")
    )
    if cached:
        return cached

    sales = _sold_comps(sb, normalised, outward, limit=20)
    rents = _rental_comps(sb, outward, limit=20)

    sale_prices = [float(item["price"]) for item in sales if _num(item.get("price"))]
    rent_prices = [float(item["rent_monthly"]) for item in rents if _num(item.get("rent_monthly"))]
    avg_price = round(mean(sale_prices)) if sale_prices else None
    median_price = round(median(sale_prices)) if sale_prices else None
    avg_rent = round(mean(rent_prices)) if rent_prices else None
    rental_yield = round((avg_rent * 12 / avg_price) * 100, 2) if avg_price and avg_rent else None

    lat, lng, _geo_raw, geo_source = _geocode_with_cache(sb, normalised)
    crime = _crime_summary(lat, lng)
    crime_index = None
    if crime and isinstance(crime.get("count"), int):
        # Derived local pressure indicator, not an official police.uk score.
        crime_index = min(100, int(crime["count"]))

    source_details = {
        "sales": "land_registry_ppd" if sale_prices else "not_available",
        "sales_match_level": sales[0].get("match_level") if sales else None,
        "rent": "internal_property_listings" if rent_prices else "not_available",
        "crime": "police.uk" if crime else "not_available",
        "geo": geo_source,
        "transport": "not_available",
        "schools": "not_available",
        "population": "not_available",
    }
    has_any = bool(sale_prices or rent_prices or crime)
    payload = {
        "key": outward or normalised,
        "postcode": normalised or outward,
        "outward_code": outward or None,
        "source": "partial_live" if has_any else "unavailable",
        "source_details": source_details,
        "confidence": "medium" if has_any else "none",
        "is_live": bool(crime),
        "is_proxy": bool(rental_yield),
        "avg_price": avg_price,
        "median_price": median_price,
        "avg_rent": avg_rent,
        "rental_yield_percent": rental_yield,
        "crime": crime,
        "crime_index": crime_index,
        "crime_index_source": "derived_from_police_count" if crime_index is not None else None,
        "transport_links": [],
        "schools_rating": None,
        "population": None,
        "notes": (
            "Based on available Land Registry sold-price records, internal rental listings and police.uk crime data. "
            "Rent and yield values are derived from internal listing evidence where available."
            if has_any
            else "No live local market intelligence is available for this area yet."
        ),
        "fetched_at": fetched_at,
    }
    _set_cache(sb, "area_intel_cache", "key", cache_key, payload)
    return payload
