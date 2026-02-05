from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Tuple

SCORE_VERSION = "v1.0"


def _to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        f = float(value)
        if not (f == f):
            return None
        return f
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            f = float(s)
        except Exception:
            return None
        if not (f == f):
            return None
        return f
    return None


def _clamp(value: float, low: float, high: float) -> float:
    if value < low:
        return low
    if value > high:
        return high
    return value


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first_float(data: Dict[str, Any], keys: list[str]) -> float | None:
    for k in keys:
        v = _to_float(data.get(k))
        if v is not None:
            return float(v)
    return None


def compute_deal_score(property_row: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Compute a deterministic 0-100 deal score for a property row.

    This is intentionally non-GPT and safe to compute at ingest time.
    Missing inputs are handled gracefully.

    Returns: (score_int, breakdown_json)
    """

    data = property_row or {}

    yield_pct = (
        _first_float(
            data,
            [
                "yield",
                "yield_percent",
                "rental_yield_percent",
                "rental_yield",
                "gross_yield",
                "yieldPercent",
            ],
        )
        or 0.0
    )
    roi_pct = (
        _first_float(
            data,
            [
                "roi",
                "roi_percent",
                "annual_roi",
                "roiPercent",
            ],
        )
        or 0.0
    )
    price = (
        _first_float(
            data,
            [
                "price",
                "asking_price",
                "list_price",
                "askingPrice",
            ],
        )
        or 0.0
    )
    rent = _first_float(data, ["rent", "avg_rent"]) or 0.0

    # Preserve explicit 0 values; only default on None.
    crime_raw = _to_float(data.get("crime_index"))
    crime = 50.0 if crime_raw is None else float(crime_raw)

    schools_raw = _to_float(data.get("schools_rating"))
    schools = 3.0 if schools_raw is None else float(schools_raw)

    price_to_rent_ratio = (price / (rent * 12.0)) if (rent and price) else 0.0

    # Yield: 0-20 points (5%+ yield = 20pts, linear)
    yield_score = min(20.0, (yield_pct / 5.0) * 20.0) if yield_pct > 0 else 0.0

    # ROI: 0-20 points (10%+ ROI = 20pts, linear)
    roi_score = min(20.0, (roi_pct / 10.0) * 20.0) if roi_pct > 0 else 0.0

    # Price-to-rent: 0-15 points (ratio < 15 = 15pts, inverse linear)
    ptr_score = 0.0
    if price_to_rent_ratio > 0:
        ptr_score = max(0.0, 15.0 - price_to_rent_ratio) if price_to_rent_ratio < 15.0 else 0.0
        ptr_score = min(15.0, ptr_score)

    # Area demand (proxy): 0-15 points (based on rent levels)
    area_score = min(15.0, (rent / 1500.0) * 15.0) if rent > 0 else 0.0

    # Crime index inverse: 0-15 points (crime 0-100, inverted)
    crime_score = ((100.0 - crime) / 100.0) * 15.0
    crime_score = _clamp(crime_score, 0.0, 15.0)

    # Schools access: 0-15 points (rating 0-5)
    schools_score = (schools / 5.0) * 15.0
    schools_score = _clamp(schools_score, 0.0, 15.0)

    total = yield_score + roi_score + ptr_score + area_score + crime_score + schools_score
    total = _clamp(total, 0.0, 100.0)

    categories = {
        "yield": round(yield_score, 1),
        "roi": round(roi_score, 1),
        "price_to_rent": round(ptr_score, 1),
        "area_demand": round(area_score, 1),
        "crime_index_inverse": round(crime_score, 1),
        "schools_access": round(schools_score, 1),
    }

    score_int = int(round(total))
    score_int = int(_clamp(float(score_int), 0.0, 100.0))

    breakdown = {
        "version": SCORE_VERSION,
        "score": score_int,
        "categories": categories,
        "computed_at": _now_iso(),
    }
    return score_int, breakdown
