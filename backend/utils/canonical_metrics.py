from __future__ import annotations

import re
from typing import Any, Dict, Iterable

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


def _get_by_path(obj: Any, path: str) -> Any:
    """Get a value from nested dicts using dot-paths (e.g., 'data.raw.rent_pcm')."""

    if not path:
        return None

    cur: Any = obj
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _first_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        f = float(value)
        if not (f == f):
            return None
        return f

    s = str(value).strip()
    if not s:
        return None

    # Normalize common formatting: currency symbols, commas, labels.
    s = s.replace(",", "")
    m = _NUMBER_RE.search(s)
    if not m:
        return None
    try:
        f = float(m.group(0))
    except Exception:
        return None
    if not (f == f):
        return None
    return f


def _positive_float(value: Any) -> float | None:
    f = _first_number(value)
    if f is None:
        return None
    if f <= 0:
        return None
    return float(f)


def _parse_percent(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        f = float(value)
        if not (f == f) or f <= 0:
            return None
        # Heuristic: treat 0-1 as fraction if caller did not include a percent sign.
        return float(f * 100.0) if (0 < f <= 1.0) else float(f)

    s = str(value).strip()
    if not s:
        return None

    f = _first_number(s)
    if f is None or f <= 0:
        return None

    # If string explicitly includes '%', it's already a percentage.
    if "%" in s:
        return float(f)

    # If it's a small fraction, treat as fractional percent.
    return float(f * 100.0) if (0 < f <= 1.0) else float(f)


def _get_first(obj: Dict[str, Any], keys: Iterable[str]) -> Any:
    for k in keys:
        v = obj.get(k) if (isinstance(k, str) and k in obj) else _get_by_path(obj, k)
        if v not in (None, "", [], {}):
            return v
    return None


def derive_canonical_metrics(row: Dict[str, Any]) -> Dict[str, Any]:
    """Derive canonical investment metrics for API payloads.

    Canonical keys:
      - price (number | null)
      - rent_monthly (number | null)
      - yield_percent (number | null)
      - roi_percent (number | null)

    Rules:
      - Never fabricate 0 values; unknown remains null.
      - If yield is missing but price+rent exist, compute yield.
      - If rent is missing but price+yield exist, compute rent.
      - ROI is only passed through (not derived) here.
    """

    out: Dict[str, Any] = {}

    price = _positive_float(
        _get_first(
            row,
            [
                "price",
                "asking_price",
                "list_price",
                "askingPrice",
                "data.price",
                "data.raw.price",
                "data.raw.displayPrice",
                "data.raw.display_price",
            ],
        )
    )

    # yield/roi can arrive under drifted keys.
    yield_pct = _parse_percent(
        _get_first(
            row,
            [
                "yield_percent",
                "rental_yield_percent",
                "rental_yield",
                "gross_yield",
                "gross_yield_percent",
                "yield",
                "yieldPct",
                "yieldPercent",
                "data.yield_percent",
                "data.rental_yield_percent",
                "data.raw.yield_percent",
                "data.raw.rental_yield_percent",
                "data.raw.gross_yield",
            ],
        )
    )
    roi_pct = _parse_percent(
        _get_first(
            row,
            [
                "roi_percent",
                "annual_roi",
                "roi",
                "roiPct",
                "roiPercent",
                "data.roi_percent",
                "data.raw.roi_percent",
                "data.raw.annual_roi",
            ],
        )
    )

    rent_monthly = _positive_float(
        _get_first(
            row,
            [
                "rent_monthly",
                "rent_pcm",
                "rent_per_month",
                "avg_rent",
                "rent",
                "rentMonthly",
                "rentPcm",
                "data.rent_monthly",
                "data.rent_pcm",
                "data.avg_rent",
                "data.rent",
                "data.raw.rent_monthly",
                "data.raw.rent_pcm",
                "data.raw.avg_rent",
                "data.raw.rent",
                "data.raw.rentMonthly",
                "data.raw.rentPcm",
            ],
        )
    )

    # Compute missing yield from rent + price.
    computed_yield: float | None = None
    if yield_pct is None and rent_monthly and price:
        computed_yield = (rent_monthly * 12.0 / price) * 100.0
        if computed_yield <= 0 or not (computed_yield == computed_yield):
            computed_yield = None

    # Compute missing rent from yield + price.
    computed_rent: float | None = None
    if rent_monthly is None and yield_pct and price:
        computed_rent = (price * (yield_pct / 100.0)) / 12.0
        if computed_rent <= 0 or not (computed_rent == computed_rent):
            computed_rent = None

    out["price"] = float(price) if price is not None else None
    out["rent_monthly"] = (
        float(rent_monthly)
        if rent_monthly is not None
        else (float(computed_rent) if computed_rent is not None else None)
    )
    out["yield_percent"] = (
        float(yield_pct)
        if yield_pct is not None
        else (float(computed_yield) if computed_yield is not None else None)
    )
    out["roi_percent"] = float(roi_pct) if roi_pct is not None else None

    # If any computed value exists, round to stable API-friendly precision.
    for k in ("price", "rent_monthly", "yield_percent", "roi_percent"):
        v = out.get(k)
        if isinstance(v, (int, float)):
            out[k] = round(float(v), 2)

    return out


def apply_canonical_metrics(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill canonical metric keys into an existing payload.

    Does not clobber existing non-null values.
    """

    metrics = derive_canonical_metrics(payload)
    for k, v in metrics.items():
        if k not in payload or payload.get(k) is None:
            payload[k] = v

    # If yield/roi were present but non-positive placeholders, prefer null.
    for k in ("yield_percent", "roi_percent", "rent_monthly", "price"):
        v = payload.get(k)
        if isinstance(v, (int, float)) and float(v) <= 0:
            payload[k] = None

    return payload
