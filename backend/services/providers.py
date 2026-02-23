from __future__ import annotations

from datetime import datetime, timezone
from statistics import median
from typing import Any, Dict, List, Optional

try:
    from backend.db import sb  # type: ignore
except Exception:  # pragma: no cover
    sb = None

from backend.utils.listing_keys import extract_postcode


def _utcnow_iso_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _outward_from_postcode(pc: str) -> Optional[str]:
    """Return the outward/district part (no spaces), e.g. SW11, EC1V, M1."""

    norm = extract_postcode(pc)
    if not norm:
        return None
    s = norm.strip().upper()
    if len(s) <= 4:
        return s
    if len(s) > 3:
        return s[:-3]
    return None


def _safe_float(v: Any) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
        if f > 0 and (f == f):
            return f
    except Exception:
        return None
    return None


def _safe_int(v: Any) -> Optional[int]:
    f = _safe_float(v)
    if f is None:
        return None
    try:
        return int(round(f))
    except Exception:
        return None


def _fetch_properties_for_postcode(postcode: str, *, limit: int = 200) -> List[Dict[str, Any]]:
    """Best-effort pull of nearby-ish property rows for deriving medians.

    Strategy:
    - Try exact postcode match first
    - If too sparse, fall back to outward prefix match (district)
    """

    if sb is None:
        return []

    pc = extract_postcode(postcode)
    if not pc:
        return []

    outward = _outward_from_postcode(pc)

    def _run_exact() -> List[Dict[str, Any]]:
        res = sb.table("properties").select("*").eq("postcode", pc).limit(int(limit)).execute()
        rows = getattr(res, "data", None) or []
        return [r for r in rows if isinstance(r, dict)]

    def _run_outward() -> List[Dict[str, Any]]:
        if not outward:
            return []
        q = sb.table("properties").select("*").like("postcode", f"{outward}%").limit(int(limit))
        res = q.execute()
        rows = getattr(res, "data", None) or []
        return [r for r in rows if isinstance(r, dict)]

    try:
        rows = _run_exact()
    except Exception:
        rows = []

    if len(rows) >= 3:
        return rows

    try:
        return _run_outward()
    except Exception:
        return rows


def get_comps_from_provider(postcode: str) -> dict:
    pc = extract_postcode(postcode) or (postcode or "").strip().upper() or "N/A"
    rows = _fetch_properties_for_postcode(pc)

    sales: List[Dict[str, Any]] = []
    rents: List[Dict[str, Any]] = []
    today = _utcnow_iso_date()

    for r in rows:
        price = _safe_int(r.get("price") or r.get("asking_price"))
        if price is not None:
            sales.append(
                {
                    "address": (r.get("title") or r.get("location") or "").strip() or None,
                    "price": price,
                    "date": (str(r.get("created_at"))[:10] if r.get("created_at") else today),
                    "type": r.get("property_type") or None,
                    "distance_km": None,
                }
            )

        rent = _safe_float(r.get("rent_monthly"))
        if rent is not None:
            rents.append(
                {
                    "address": (r.get("title") or r.get("location") or "").strip() or None,
                    "monthly_rent": round(float(rent), 2),
                    "date": (str(r.get("created_at"))[:10] if r.get("created_at") else today),
                    "type": r.get("property_type") or None,
                    "distance_km": None,
                }
            )

    return {"postcode": pc, "sales": sales, "rents": rents}


def get_area_intel_from_provider(key: str) -> dict:
    k = extract_postcode(key) or (key or "").strip().upper() or "UNKNOWN"
    rows = _fetch_properties_for_postcode(k)

    prices: List[float] = []
    rents: List[float] = []

    for r in rows:
        p = _safe_float(r.get("price") or r.get("asking_price"))
        if p is not None:
            prices.append(p)
        rm = _safe_float(r.get("rent_monthly"))
        if rm is not None:
            rents.append(rm)

    avg_price = median(prices) if prices else None
    avg_rent = median(rents) if rents else None

    rental_yield_percent = None
    if avg_price and avg_rent and avg_price > 0:
        try:
            rental_yield_percent = round((avg_rent * 12.0) / avg_price * 100.0, 2)
        except Exception:
            rental_yield_percent = None

    return {
        "key": k,
        "avg_price": (round(float(avg_price), 0) if isinstance(avg_price, (int, float)) else None),
        "avg_rent": (round(float(avg_rent), 0) if isinstance(avg_rent, (int, float)) else None),
        "rental_yield_percent": rental_yield_percent,
        "crime_index": None,
        "schools_rating": None,
        "transport_links": [],
        "population": None,
        "notes": None,
    }
