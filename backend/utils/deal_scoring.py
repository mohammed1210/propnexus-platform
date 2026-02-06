from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Tuple

from backend.utils.listing_keys import extract_postcode

SCORE_VERSION = "v1.1"


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


def _to_int(value: Any) -> int | None:
    f = _to_float(value)
    if f is None:
        return None
    try:
        return int(round(f))
    except Exception:
        return None


def _postcode_band(data: Dict[str, Any]) -> str | None:
    pc = (
        extract_postcode(data.get("postcode"))
        or extract_postcode(data.get("address"))
        or extract_postcode(data.get("location"))
        or extract_postcode(data.get("title"))
    )
    if not pc:
        return None

    # Central London heuristics (MVP): SW1/W1/WC1/EC1.
    central_prefixes = ("SW1", "W1", "WC1", "EC1")
    if pc.startswith(central_prefixes):
        return "central"

    # Other common London area prefixes (very rough).
    london_prefixes = ("E", "SE", "SW", "N", "NW", "W", "EC", "WC")
    if pc.startswith(london_prefixes):
        return "outer"

    return "other"


def _cap_rate_percent(band: str, bedrooms: int) -> float:
    beds = max(0, min(int(bedrooms), 10))

    if band == "central":
        base = 3.2
        per_bed = 0.2
        cap = 4.0
    elif band == "outer":
        base = 4.8
        per_bed = 0.25
        cap = 6.0
    else:
        base = 5.5
        per_bed = 0.3
        cap = 7.0

    rate = base + max(0, beds - 1) * per_bed
    return float(_clamp(rate, 2.5, cap))


def compute_deal_score(property_row: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Compute a deterministic 0-100 deal score for a property row.

    This is intentionally non-GPT and safe to compute at ingest time.
    Missing inputs are handled gracefully.

    Returns: (score_int, breakdown_json)
    """

    data = property_row or {}

    yield_pct_raw = _first_float(
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
    roi_pct_raw = _first_float(
        data,
        [
            "roi",
            "roi_percent",
            "annual_roi",
            "roiPercent",
        ],
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
    bedrooms = (
        _to_int(data.get("bedrooms"))
        or _to_int(data.get("beds"))
        or _to_int(data.get("num_bedrooms"))
        or 0
    )
    rent_raw = _first_float(data, ["rent", "avg_rent"]) or 0.0

    # Preserve explicit 0 values; only default on None.
    crime_raw = _to_float(data.get("crime_index"))
    crime = 50.0 if crime_raw is None else float(crime_raw)

    schools_raw = _to_float(data.get("schools_rating"))
    schools = 3.0 if schools_raw is None else float(schools_raw)

    band = _postcode_band(data)

    cap_rate_pct = None
    rent_proxy = 0.0
    if (rent_raw <= 0.0) and (yield_pct_raw is None) and band and price > 0:
        cap_rate_pct = _cap_rate_percent(band, bedrooms)
        rent_proxy = (price * (cap_rate_pct / 100.0)) / 12.0

    rent = rent_raw if rent_raw > 0.0 else rent_proxy
    yield_pct = yield_pct_raw
    if yield_pct is None and rent > 0.0 and price > 0.0:
        yield_pct = (rent * 12.0 / price) * 100.0
    if yield_pct is None:
        yield_pct = 0.0

    roi_pct = roi_pct_raw if roi_pct_raw is not None else 0.0

    price_to_rent_ratio = (price / (rent * 12.0)) if (rent and price) else 0.0

    # Yield: 0-20 points (5%+ yield = 20pts, linear)
    yield_score = min(20.0, (yield_pct / 5.0) * 20.0) if yield_pct > 0 else 0.0

    # ROI: 0-20 points (10%+ ROI = 20pts, linear)
    roi_score = min(20.0, (roi_pct / 10.0) * 20.0) if roi_pct > 0 else 0.0

    # Price-to-rent: 0-15 points.
    # MVP: ratio <= 15 => 15pts, ratio >= 30 => 0pts, linear in-between.
    ptr_score = 0.0
    if price_to_rent_ratio > 0:
        if price_to_rent_ratio <= 15.0:
            ptr_score = 15.0
        elif price_to_rent_ratio >= 30.0:
            ptr_score = 0.0
        else:
            ptr_score = 15.0 * (30.0 - price_to_rent_ratio) / 15.0
        ptr_score = _clamp(ptr_score, 0.0, 15.0)

    # Area demand (proxy): 0-15 points.
    # When we have a postcode band, prefer it as the core signal.
    area_score = 0.0
    if band == "central":
        area_score = 13.0
    elif band == "outer":
        area_score = 9.0
    elif band == "other":
        area_score = 7.0
    elif rent > 0:
        # Fallback: scale with rent but avoid instant saturation.
        area_score = ((rent - 800.0) / 2500.0) * 15.0

    if area_score and rent > 0:
        # Small adjustment so higher rents nudge demand up.
        area_score += _clamp((rent - 1000.0) / 5000.0 * 2.0, 0.0, 2.0)
    area_score = _clamp(area_score, 0.0, 15.0)

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
        "inputs": {
            "price": round(price, 2),
            "bedrooms": int(bedrooms),
            "postcode_band": band,
            "rent_monthly": round(rent, 2),
            "rent_source": (
                "provided" if rent_raw > 0.0 else ("proxy" if rent_proxy > 0.0 else "missing")
            ),
            "cap_rate_proxy_percent": (
                round(float(cap_rate_pct), 2) if cap_rate_pct is not None else None
            ),
        },
        "computed_at": _now_iso(),
    }
    return score_int, breakdown
