from __future__ import annotations

from typing import Optional


def _clamp(value: float, low: float, high: float) -> float:
    if value < low:
        return low
    if value > high:
        return high
    return value


_DEMAND_CITIES = [
    "london",
    "manchester",
    "birmingham",
    "liverpool",
    "leeds",
    "bristol",
]


def compute_off_market_score(
    *,
    asking_price: Optional[float],
    estimated_value: Optional[float],
    discount_percent: Optional[float],
    bedrooms: Optional[int],
    location: Optional[str],
) -> int:
    """Compute a deterministic 0-100 score for an off-market lead."""

    base = 50.0

    disc = float(discount_percent) if discount_percent is not None else 0.0
    discount_score = _clamp(disc, 0.0, 30.0) * 1.5

    beds = float(bedrooms) if bedrooms is not None else 0.0
    bedroom_score = _clamp(beds, 0.0, 6.0) * 3.0

    value_score = 0.0
    if (
        estimated_value is not None
        and asking_price is not None
        and float(estimated_value) > float(asking_price)
    ):
        value_score = 10.0

    demand_proxy = 0.0
    loc = (location or "").lower()
    if any(c in loc for c in _DEMAND_CITIES):
        demand_proxy = 5.0

    total = base + discount_score + bedroom_score + value_score + demand_proxy
    return int(_clamp(float(int(total)), 0.0, 100.0))
