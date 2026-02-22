import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from ..db import sb  # Supabase client provided by backend/main.py

router = APIRouter(prefix="/comps", tags=["comps"])


_WS_RE = re.compile(r"\s+")


def _normalize_postcode(value: str) -> str:
    return _WS_RE.sub("", (value or "").strip().upper())


def _outward_code(pc_norm: str) -> str:
    # UK postcode inward code is 3 chars; outward is the prefix.
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


def _require_supabase():
    if sb is None:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return sb


def _select_properties_for_postcode(
    sb2: Any, *, pc_norm: str, limit: int = 500
) -> tuple[str, list[Dict[str, Any]]]:
    cols = "postcode,price,asking_price,rent_monthly,rent,avg_rent,yield_percent,roi_percent"

    # 1) exact match (stored postcode may have spaces, so try both forms).
    candidates: list[str] = []
    if pc_norm:
        # Add a space before last 3 chars if it's a full postcode.
        if len(pc_norm) > 3:
            candidates.append(f"{pc_norm[:-3]} {pc_norm[-3:]}")
        candidates.append(pc_norm)

    rows: list[Dict[str, Any]] = []
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

    # 2) outward fallback
    outward = _outward_code(pc_norm)
    if not outward:
        return "none", []

    try:
        q = sb2.table("properties").select(cols)
        # Prefer ilike when available; fall back to like.
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


@router.get("/{postcode}")
def get_comps(postcode: str, request: Request) -> Dict[str, Any]:
    sb2 = _require_supabase()

    pc_norm = _normalize_postcode(postcode or "")
    if not pc_norm:
        raise HTTPException(status_code=400, detail="postcode required")

    match_level, rows = _select_properties_for_postcode(sb2, pc_norm=pc_norm)
    count = len(rows)

    prices: list[float] = []
    rents: list[float] = []

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

    return {
        "source": "db",
        "postcode": pc_norm,
        "match_level": match_level,
        "count": count,
        "median_price": _median(prices),
        "median_rent": _median(rents),
    }
