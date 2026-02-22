from __future__ import annotations

import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from backend.utils.supabase_client import get_supabase

router = APIRouter(prefix="/area-intel", tags=["area-intel"])

_WS_RE = re.compile(r"\s+")


def _normalize_postcode(value: str) -> str:
    return _WS_RE.sub("", (value or "").strip().upper())


def _outward_code(pc_norm: str) -> str:
    if not pc_norm:
        return ""
    if len(pc_norm) <= 3:
        return pc_norm
    return pc_norm[:-3]


def _median(nums: list[float]) -> Optional[float]:
    a = [float(x) for x in nums if isinstance(x, (int, float))]
    a = [x for x in a if x > 0 and x == x]
    if not a:
        return None
    a.sort()
    mid = len(a) // 2
    if len(a) % 2 == 1:
        return a[mid]
    return (a[mid - 1] + a[mid]) / 2


def _select_properties_for_key(
    sb2: Any, *, key_norm: str, limit: int = 500
) -> tuple[str, list[Dict[str, Any]]]:
    cols = "postcode,price,asking_price,rent_monthly,rent,avg_rent,yield_percent,roi_percent"

    candidates: list[str] = []
    if key_norm:
        if len(key_norm) > 3:
            candidates.append(f"{key_norm[:-3]} {key_norm[-3:]}")
        candidates.append(key_norm)

    for c in candidates:
        try:
            res = sb2.table("properties").select(cols).eq("postcode", c).limit(limit).execute()
            data = getattr(res, "data", None) or []
            if isinstance(data, list) and data:
                rows = [r for r in data if isinstance(r, dict)]
                if rows:
                    return "postcode", rows
        except Exception:
            continue

    outward = _outward_code(key_norm)
    if not outward:
        return "none", []
    try:
        q = sb2.table("properties").select(cols)
        if hasattr(q, "ilike"):
            q = q.ilike("postcode", f"{outward}%")
        else:
            q = q.like("postcode", f"{outward}%")
        res = q.limit(limit).execute()
        data = getattr(res, "data", None) or []
        rows = [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []
        return "outward", rows
    except Exception:
        return "outward", []


@router.get("/{key}")
def get_area_intel(key: str, request: Request):
    """DB-backed area intel (no external provider).

    The key is treated as a postcode-ish identifier. We prefer exact postcode matches,
    then fall back to outward code when needed.
    """

    sb2 = get_supabase()
    if not sb2:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    key_norm = _normalize_postcode(key)
    if not key_norm:
        raise HTTPException(status_code=400, detail="key required")

    match_level, rows = _select_properties_for_key(sb2, key_norm=key_norm)
    count = len(rows)

    prices: list[float] = []
    rents: list[float] = []
    yields: list[float] = []

    for r in rows:
        try:
            p = r.get("price") or r.get("asking_price")
            if isinstance(p, (int, float)) and p > 0:
                prices.append(float(p))
        except Exception:
            pass

        try:
            rm = r.get("rent_monthly") or r.get("rent") or r.get("avg_rent")
            if isinstance(rm, (int, float)) and rm > 0:
                rents.append(float(rm))
        except Exception:
            pass

        try:
            y = r.get("yield_percent")
            if isinstance(y, (int, float)) and y > 0:
                yields.append(float(y))
        except Exception:
            pass

    median_price = _median(prices)
    median_rent = _median(rents)
    median_yield = _median(yields)

    # Return a payload that is both explicit (db medians) and broadly compatible with
    # existing UI fields (avg_* aliases), without fabricating missing data.
    return {
        "source": "db",
        "key": key_norm,
        "match_level": match_level,
        "count": count,
        "median_price": median_price,
        "median_rent": median_rent,
        "median_yield_percent": median_yield,
        # Compatibility aliases (all DB-derived; may be null)
        "avg_price": median_price,
        "avg_rent": median_rent,
        "rental_yield_percent": median_yield,
        "avgYieldPct": median_yield,
        "avgRent": median_rent,
        "crimeRateIndex": None,
        "ofstedSummary": None,
        "transportSummary": None,
        "crime_index": None,
        "schools_rating": None,
        "transport_links": [],
        "notes": None,
    }
