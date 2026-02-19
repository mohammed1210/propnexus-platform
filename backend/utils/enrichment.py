from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple
from urllib.parse import quote

import httpx

from backend.utils.listing_keys import extract_postcode
from backend.utils.ppd_comps import get_sold_comps_summary
from backend.utils.rate_limiter import AsyncRateLimiter

_external_limiter = AsyncRateLimiter(min_interval_sec=float(os.getenv("ENRICH_RATE_SEC", "1.0")))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _clamp_float(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except Exception:
        return None
    if not (f == f):
        return None
    return f


def _is_zero_coord(lat: float | None, lng: float | None) -> bool:
    try:
        if lat is None or lng is None:
            return False
        return float(lat) == 0.0 and float(lng) == 0.0
    except Exception:
        return False


def _coord_missing(lat: float | None, lng: float | None) -> bool:
    return lat is None or lng is None or _is_zero_coord(lat, lng)


def _coerce_int(v: Any) -> int | None:
    if v is None or isinstance(v, bool):
        return None
    try:
        i = int(float(v))
    except Exception:
        return None
    return i if i > 0 else None


def _last_complete_month() -> str:
    # police.uk expects YYYY-MM
    now = _utcnow().date()
    first_this_month = now.replace(day=1)
    last_month_end = first_this_month - timedelta(days=1)
    return f"{last_month_end.year:04d}-{last_month_end.month:02d}"


async def geocode_postcode(
    postcode: str,
) -> Tuple[float | None, float | None, Dict[str, Any] | None, str]:
    """Resolve postcode to lat/lng.

    Default provider is postcodes.io because it's reliable for UK postcodes.
    If `GEO_PROVIDER=nominatim`, uses OpenStreetMap Nominatim.
    """

    pc = (postcode or "").strip().upper()
    if not pc:
        return None, None, None, "missing"

    provider = (os.getenv("GEO_PROVIDER") or "postcodes.io").strip().lower()
    timeout = float(os.getenv("GEO_TIMEOUT_SECONDS", "10"))

    user_agent = os.getenv(
        "GEO_USER_AGENT",
        "PropNexus/1.0 (contact: support@propnexus.ai)",
    )

    async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": user_agent}) as client:
        if provider == "nominatim":
            # Nominatim usage policy requires a valid User-Agent.
            await _external_limiter.wait()
            url = "https://nominatim.openstreetmap.org/search"
            params = {"q": pc, "format": "json", "limit": 1}
            r = await client.get(url, params=params)
            if r.status_code != 200:
                return (
                    None,
                    None,
                    {"status_code": r.status_code, "body": (r.text or "")[:500]},
                    "nominatim",
                )
            try:
                data = r.json()
            except Exception:
                data = None
            if isinstance(data, list) and data:
                lat = _clamp_float(data[0].get("lat"))
                lng = _clamp_float(data[0].get("lon"))
                return lat, lng, data[0], "nominatim"
            return None, None, {"results": data}, "nominatim"

        # postcodes.io
        url = f"https://api.postcodes.io/postcodes/{quote(pc)}"
        await _external_limiter.wait()
        r = await client.get(url)
        if r.status_code != 200:
            return (
                None,
                None,
                {"status_code": r.status_code, "body": (r.text or "")[:500], "postcode": pc},
                "postcodes.io",
            )
        try:
            payload = r.json()
        except Exception:
            payload = None
        result = payload.get("result") if isinstance(payload, dict) else None
        lat = _clamp_float(result.get("latitude")) if isinstance(result, dict) else None
        lng = _clamp_float(result.get("longitude")) if isinstance(result, dict) else None
        return lat, lng, payload, "postcodes.io"


async def fetch_crime_police_uk(*, latitude: float, longitude: float) -> Dict[str, Any]:
    """Fetch crime incidents (police.uk) and return a compact summary."""

    lat = _clamp_float(latitude)
    lng = _clamp_float(longitude)
    if lat is None or lng is None:
        return {"source": "police.uk", "count": 0, "month": None}

    month = _last_complete_month()
    timeout = float(os.getenv("CRIME_TIMEOUT_SECONDS", "12"))

    user_agent = os.getenv(
        "CRIME_USER_AGENT",
        "PropNexus/1.0 (contact: support@propnexus.ai)",
    )

    async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": user_agent}) as client:
        await _external_limiter.wait()
        url = "https://data.police.uk/api/crimes-street/all-crime"
        params = {"lat": f"{lat:.6f}", "lng": f"{lng:.6f}", "date": month}
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    count = len(data) if isinstance(data, list) else 0
    # Keep raw data out of the cache payload by default; it can be very large.
    return {"source": "police.uk", "count": count, "month": month}


def derive_rent_yield_roi(*, property_row: Dict[str, Any]) -> Dict[str, Any]:
    """Derive rent/yield/roi using existing scoring heuristics.

    v1 intentionally stays simple and deterministic.
    """

    price = _coerce_int(property_row.get("price") or property_row.get("asking_price"))
    rent_monthly: float | None = None

    # IMPORTANT: Do not invent rent via heuristics/assumptions.
    # Prefer an explicitly stored/provided rent value if present.
    rv = property_row.get("rent_monthly")
    try:
        rf = float(rv) if rv is not None else None
        if rf is not None and rf > 0:
            rent_monthly = rf
    except Exception:
        rent_monthly = None

    yield_percent: float | None = None
    if price and rent_monthly and price > 0:
        yield_percent = (rent_monthly * 12.0 / float(price)) * 100.0

    cost_drag = float(os.getenv("ENRICH_ROI_COST_DRAG_PCT", "1.0"))
    roi_percent: float | None = None
    if yield_percent is not None:
        roi_percent = yield_percent - cost_drag

    return {
        "rent_estimate_monthly": (
            round(rent_monthly, 2) if isinstance(rent_monthly, (int, float)) else None
        ),
        "yield_percent": (
            round(yield_percent, 2) if isinstance(yield_percent, (int, float)) else None
        ),
        "roi_percent": round(roi_percent, 2) if isinstance(roi_percent, (int, float)) else None,
        "roi_cost_drag_pct": cost_drag,
    }


async def build_property_enrichment(
    *,
    sb: Any,
    property_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Compute enrichment payload for a property row."""

    postcode = extract_postcode(property_row.get("postcode"))

    lat = _clamp_float(property_row.get("latitude"))
    lng = _clamp_float(property_row.get("longitude"))

    # Treat (0,0) as missing (common bad default).
    if _is_zero_coord(lat, lng):
        lat, lng = None, None

    geo_raw: Dict[str, Any] | None = None
    geo_source = "existing"

    if _coord_missing(lat, lng):
        geo_source = "missing"
        if isinstance(postcode, str) and postcode.strip():
            try:
                glat, glng, geo_raw, geo_source = await geocode_postcode(postcode)
            except Exception:
                glat, glng, geo_raw, geo_source = None, None, {"error": "geocode_failed"}, "missing"

            if not _coord_missing(glat, glng):
                lat, lng = glat, glng

    # Final guard: do not emit/store (0,0)
    if _is_zero_coord(lat, lng):
        lat, lng = None, None

    crime: Dict[str, Any] | None = None
    if lat is not None and lng is not None:
        try:
            crime = await fetch_crime_police_uk(latitude=lat, longitude=lng)
        except Exception:
            crime = {"source": "police.uk", "count": 0, "month": None, "error": "fetch_failed"}

    sold_comps: Dict[str, Any] | None = None
    try:
        sold_comps = get_sold_comps_summary(sb, postcode=postcode)
    except Exception:
        sold_comps = {"count": 0, "median_price": None, "items": [], "source": "land-registry-ppd"}

    derived = derive_rent_yield_roi(property_row=property_row)

    return {
        "geo": {
            "postcode": postcode,
            "latitude": lat,
            "longitude": lng,
            "source": geo_source,
            "raw": geo_raw,
        },
        "area_intel": {
            "crime": crime,
        },
        "comps": {
            "sold": sold_comps,
        },
        "derived": derived,
        "generated_at": _utcnow().isoformat(),
        "version": "v1",
    }
