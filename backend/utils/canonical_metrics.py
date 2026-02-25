from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable

from backend.utils.listing_keys import extract_postcode

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


@dataclass(frozen=True)
class RoiAssumptions:
    ltv: float = 0.75
    interest_rate: float = 0.055
    opex_ratio: float = 0.25
    purchase_cost_ratio: float = 0.03
    clamp_low: float = -50.0
    clamp_high: float = 50.0


DEFAULT_ROI_ASSUMPTIONS = RoiAssumptions()


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
        if k in obj:
            v = obj.get(k)
            if v not in (None, "", [], {}):
                return v
    return None


def _clamp(value: float, low: float, high: float) -> float:
    if value < low:
        return low
    if value > high:
        return high
    return value


def compute_gross_yield_percent(*, price: float, rent_monthly: float) -> float | None:
    if price <= 0 or rent_monthly <= 0:
        return None
    y = (rent_monthly * 12.0 / price) * 100.0
    if not (y == y) or y <= 0:
        return None
    return float(y)


def compute_cash_on_cash_roi_percent(
    *,
    price: float,
    rent_monthly: float,
    assumptions: RoiAssumptions = DEFAULT_ROI_ASSUMPTIONS,
) -> float | None:
    """Cash-on-cash ROI proxy.

    ROI proxy = net annual cashflow / cash invested.
    Uses interest-only mortgage assumptions + opex buffer.
    """

    if price <= 0 or rent_monthly <= 0:
        return None

    ltv = assumptions.ltv
    if ltv <= 0 or ltv >= 1:
        return None

    loan = price * ltv
    cash_in = price * (1.0 - ltv) + price * assumptions.purchase_cost_ratio
    if cash_in <= 0:
        return None

    annual_rent = rent_monthly * 12.0
    annual_opex = annual_rent * assumptions.opex_ratio
    annual_interest = loan * assumptions.interest_rate
    annual_net_cashflow = annual_rent - annual_opex - annual_interest

    roi = (annual_net_cashflow / cash_in) * 100.0
    if not (roi == roi):
        return None

    return float(_clamp(float(roi), assumptions.clamp_low, assumptions.clamp_high))


def _postcode_band(row: Dict[str, Any]) -> str | None:
    """Very small heuristic banding used for rent proxying.

    We reuse the same outward-band idea as deal scoring, but keep it lightweight.
    """

    full = (
        extract_postcode(row.get("postcode"))
        or extract_postcode(row.get("address"))
        or extract_postcode(row.get("location"))
        or extract_postcode(row.get("title"))
    )
    if not full:
        return None

    pc = re.sub(r"\s+", "", str(full).upper().strip())
    m = re.match(r"^([A-Z]{1,2}\d{1,2}[A-Z]?)", pc)
    outward = m.group(1) if m else pc
    if not outward:
        return None

    def _is_central_prefix(code: str) -> bool:
        if code.startswith("SW1"):
            return len(code) == 3 or (len(code) == 4 and code[3].isalpha())
        if code.startswith("W1"):
            return len(code) == 2 or (len(code) == 3 and code[2].isalpha())
        if code.startswith("WC1"):
            return len(code) == 3 or (len(code) == 4 and code[3].isalpha())
        if code.startswith("EC1"):
            return len(code) == 3 or (len(code) == 4 and code[3].isalpha())
        return False

    if _is_central_prefix(outward):
        return "central"

    london_prefixes = ("E", "SE", "SW", "N", "NW", "W", "EC", "WC")
    if outward.startswith(london_prefixes):
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
    return float(_clamp(float(rate), 2.5, cap))


def derive_canonical_metrics(row: Dict[str, Any]) -> Dict[str, Any]:
    """Derive canonical investment metrics for API payloads.

        Canonical keys:
      - price (number | null)
      - rent_monthly (number | null)
      - yield_percent (number | null)
      - roi_percent (number | null)
            - roi_is_proxy (bool)
            - rent_source ("provided" | "proxy" | "missing")

    Rules:
      - Never fabricate 0 values; unknown remains null.
      - If yield is missing but price+rent exist, compute yield.
      - If rent is missing but price+yield exist, compute rent.
            - ROI is kept if provided; otherwise computed as a cash-on-cash proxy.
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
            ],
        )
    )

    rent_source: str = "provided" if rent_monthly is not None else "missing"

    # If rent is entirely missing AND yield is missing, attempt a very lightweight proxy rent.
    # This prevents the UI from showing blank Yield/ROI for scraped feeds that omit rent.
    if rent_monthly is None and yield_pct is None and price:
        band = _postcode_band(row)
        beds_raw = _first_number(
            _get_first(row, ["bedrooms", "beds", "numBedrooms", "numberOfBedrooms"])
        )
        bedrooms = int(round(beds_raw)) if beds_raw is not None else 0
        if band:
            cap_rate_pct = _cap_rate_percent(band, bedrooms)
            proxy_rent = (price * (cap_rate_pct / 100.0)) / 12.0
            if proxy_rent > 0 and (proxy_rent == proxy_rent):
                rent_monthly = float(proxy_rent)
                rent_source = "proxy"

    # Compute missing yield from rent + price.
    computed_yield: float | None = None
    if yield_pct is None and rent_monthly and price:
        computed_yield = compute_gross_yield_percent(
            price=float(price), rent_monthly=float(rent_monthly)
        )
        if computed_yield <= 0 or not (computed_yield == computed_yield):
            computed_yield = None

    # Compute missing rent from yield + price.
    computed_rent: float | None = None
    if rent_monthly is None and yield_pct and price:
        computed_rent = (price * (yield_pct / 100.0)) / 12.0
        if computed_rent <= 0 or not (computed_rent == computed_rent):
            computed_rent = None

    final_price = float(price) if price is not None else None
    final_rent = (
        float(rent_monthly)
        if rent_monthly is not None
        else (float(computed_rent) if computed_rent is not None else None)
    )
    final_yield = (
        float(yield_pct)
        if yield_pct is not None
        else (float(computed_yield) if computed_yield is not None else None)
    )

    roi_is_proxy = False
    final_roi = float(roi_pct) if roi_pct is not None else None
    if final_roi is None and final_price and final_rent:
        proxy_roi = compute_cash_on_cash_roi_percent(price=final_price, rent_monthly=final_rent)
        if proxy_roi is not None:
            final_roi = float(proxy_roi)
            roi_is_proxy = True

    out["price"] = final_price
    out["rent_monthly"] = final_rent
    out["yield_percent"] = final_yield
    out["roi_percent"] = final_roi
    out["roi_is_proxy"] = bool(roi_is_proxy)
    out["rent_source"] = rent_source

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
