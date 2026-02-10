from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple

from backend.utils.deal_scoring import compute_deal_score

DealType = Literal["balanced", "cashflow", "growth"]


_CATEGORY_MAX: Dict[str, float] = {
    "yield": 20.0,
    "roi": 20.0,
    "price_to_rent": 15.0,
    "area_demand": 15.0,
    "crime_index_inverse": 15.0,
    "schools_access": 15.0,
}


_PERSONA_WEIGHTS: Dict[DealType, Dict[str, float]] = {
    "balanced": {
        "yield": 1.0,
        "roi": 1.0,
        "price_to_rent": 1.0,
        "area_demand": 1.0,
        "crime_index_inverse": 1.0,
        "schools_access": 1.0,
    },
    "cashflow": {
        "yield": 1.25,
        "roi": 1.2,
        "price_to_rent": 1.1,
        "area_demand": 0.9,
        "crime_index_inverse": 0.9,
        "schools_access": 0.9,
    },
    "growth": {
        "yield": 0.95,
        "roi": 0.95,
        "price_to_rent": 0.95,
        "area_demand": 1.25,
        "crime_index_inverse": 1.05,
        "schools_access": 1.1,
    },
}


def _is_luxury_query(query_text: str | None) -> bool:
    q = (query_text or "").strip().lower()
    if not q:
        return False
    # Intentionally small/strict keyword set; safe default is non-luxury.
    luxury_markers = {
        "luxury",
        "lux",
        "penthouse",
        "mansion",
        "exclusive",
        "prime",
        "mayfair",
        "knightsbridge",
        "kensington",
        "chelsea",
    }
    return any(m in q for m in luxury_markers)


def _to_float(v: Any) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return f if f == f else None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            f = float(s)
        except Exception:
            return None
        return f if f == f else None
    return None


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def normalize_deal_type(value: Any) -> DealType:
    s = str(value or "").strip().lower()
    if s in ("balanced", "cashflow", "growth"):
        return s  # type: ignore[return-value]
    return "balanced"


@dataclass(frozen=True)
class RecommendedMeta:
    score: float
    reasons: List[str]
    tier: int


def _get_breakdown(row: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Return (score_int, breakdown_json), computing if missing."""

    score_val = row.get("score")
    breakdown = row.get("score_breakdown")

    if isinstance(breakdown, dict) and isinstance(breakdown.get("categories"), dict):
        s = _to_float(score_val)
        if s is not None:
            return int(round(_clamp(float(s), 0.0, 100.0))), breakdown

    # Compute deterministically from row snapshot.
    score_int, breakdown_json = compute_deal_score(row)
    return score_int, breakdown_json


def _weighted_score_from_categories(categories: Dict[str, Any], deal_type: DealType) -> float:
    weights = _PERSONA_WEIGHTS[deal_type]
    denom = 0.0
    numer = 0.0
    for k, max_points in _CATEGORY_MAX.items():
        w = float(weights.get(k, 1.0))
        denom += w
        pts = _to_float(categories.get(k)) or 0.0
        frac = 0.0 if max_points <= 0 else _clamp(pts / max_points, 0.0, 1.0)
        numer += w * frac

    if denom <= 0:
        return 0.0
    return _clamp((numer / denom) * 100.0, 0.0, 100.0)


def _rent_penalty(
    *, rent_source: str | None, rent_monthly: float | None, yield_percent: float | None
) -> float:
    """Strongly downrank missing rent and missing/zero rent signals.

    Spec:
    - strongly downrank when rent_source == "missing" OR rent_monthly <= 0
    - strongly downrank when yield_percent == 0 when rent missing
    """

    src = (rent_source or "").strip().lower()
    rent_m = rent_monthly if isinstance(rent_monthly, (int, float)) else None
    y = yield_percent if isinstance(yield_percent, (int, float)) else None

    if src == "provided":
        return 0.0

    if src == "proxy":
        # Proxy rents are acceptable, but lower confidence.
        penalty = -10.0
        if rent_m is not None and rent_m <= 0:
            penalty -= 35.0
        return penalty

    if src == "missing":
        penalty = -45.0
        if rent_m is not None and rent_m <= 0:
            penalty -= 10.0
        if y is not None and y <= 0:
            penalty -= 20.0
        return penalty

    # Unknown rent source: treat as low confidence.
    penalty = -20.0
    if rent_m is not None and rent_m <= 0:
        penalty -= 20.0
    return penalty


def _high_price_penalty(*, price: float | None, deal_type: DealType) -> float:
    if price is None or price <= 0:
        return 0.0

    # Cashflow persona should dislike expensive properties more.
    if deal_type == "cashflow":
        if price <= 750_000:
            return 0.0
        # Up to -15 pts for very high prices.
        return -_clamp(((price - 750_000) / 250_000) * 5.0, 0.0, 15.0)

    if price <= 1_000_000:
        return 0.0
    return -5.0


def _luxury_outlier_penalty(
    *, price: float | None, query_text: str | None, deal_type: DealType
) -> float:
    if price is None:
        return 0.0
    if price <= 1_000_000:
        return 0.0
    if _is_luxury_query(query_text):
        return 0.0
    # Heavy downrank for default browsing; do not exclude.
    return -45.0 if deal_type == "cashflow" else -35.0


def _discount_boost(discount_percent: Any) -> float:
    dp = _to_float(discount_percent)
    if dp is None or dp <= 0:
        return 0.0
    # modest boost (cap to avoid dominating)
    return _clamp(dp * 0.2, 0.0, 5.0)


def _extract_reasons(
    *,
    row: Dict[str, Any],
    categories: Dict[str, Any],
    inputs: Dict[str, Any],
    deal_type: DealType,
) -> List[str]:
    reasons: List[str] = []

    yield_pct = _to_float(row.get("yield_percent"))
    roi_pct = _to_float(row.get("roi_percent"))
    discount_pct = _to_float(row.get("discount_percent"))

    rent_source = str(inputs.get("rent_source") or "").strip().lower() or None

    cat_yield = _to_float(categories.get("yield")) or 0.0
    cat_roi = _to_float(categories.get("roi")) or 0.0
    cat_ptr = _to_float(categories.get("price_to_rent")) or 0.0
    cat_area = _to_float(categories.get("area_demand")) or 0.0
    cat_crime = _to_float(categories.get("crime_index_inverse")) or 0.0
    cat_schools = _to_float(categories.get("schools_access")) or 0.0

    def add(reason: str) -> None:
        if reason not in reasons:
            reasons.append(reason)

    # Candidate reasons (thresholds chosen to be conservative).
    if (yield_pct is not None and yield_pct >= 6.0) or cat_yield >= 16.0:
        add("High yield")
    if (roi_pct is not None and roi_pct >= 12.0) or cat_roi >= 16.0:
        add("Strong ROI")
    if cat_ptr >= 12.0:
        add("Low price-to-rent")
    if discount_pct is not None and discount_pct >= 10.0:
        add("Good discount")
    if rent_source == "provided":
        add("Rent provided")

    if cat_area >= 12.0:
        add("Strong area demand")
    if cat_schools >= 12.0:
        add("Good schools access")
    if cat_crime >= 12.0:
        add("Lower crime area")

    # Prioritize by persona.
    if deal_type == "cashflow":
        priority = [
            "High yield",
            "Strong ROI",
            "Low price-to-rent",
            "Rent provided",
            "Good discount",
            "Strong area demand",
            "Good schools access",
            "Lower crime area",
        ]
    elif deal_type == "growth":
        priority = [
            "Strong area demand",
            "Good schools access",
            "Lower crime area",
            "Good discount",
            "Strong ROI",
            "High yield",
            "Low price-to-rent",
            "Rent provided",
        ]
    else:
        priority = [
            "Strong ROI",
            "High yield",
            "Low price-to-rent",
            "Good discount",
            "Strong area demand",
            "Good schools access",
            "Lower crime area",
            "Rent provided",
        ]

    ordered = [r for r in priority if r in reasons]
    return ordered[:3]


def compute_recommended_meta(
    row: Dict[str, Any],
    deal_type: DealType,
    *,
    query_text: str | None = None,
) -> RecommendedMeta:
    base_score, breakdown = _get_breakdown(row)
    categories = breakdown.get("categories") if isinstance(breakdown, dict) else None
    inputs = breakdown.get("inputs") if isinstance(breakdown, dict) else None
    if not isinstance(categories, dict):
        categories = {}
    if not isinstance(inputs, dict):
        inputs = {}

    rec = _weighted_score_from_categories(categories, deal_type)

    rent_source = str(inputs.get("rent_source") or "")
    rent_monthly = _to_float(inputs.get("rent_monthly"))
    yield_percent = _to_float(row.get("yield_percent"))
    rec += _rent_penalty(
        rent_source=rent_source,
        rent_monthly=rent_monthly,
        yield_percent=yield_percent,
    )
    rec += _discount_boost(row.get("discount_percent"))

    # Guardrail: missing/invalid price should not float to the top.
    price = _to_float(row.get("price"))
    if price is None or price <= 0:
        rec -= 10.0
    else:
        rec += _high_price_penalty(price=price, deal_type=deal_type)
        rec += _luxury_outlier_penalty(price=price, query_text=query_text, deal_type=deal_type)

    rec = _clamp(rec, 0.0, 100.0)

    # Tiers are a soft-filter signal; we can relax thresholds if too few exist.
    rent_source_norm = str(inputs.get("rent_source") or "").strip().lower()
    tier = 0
    if rec >= 70.0 and rent_source_norm in {"provided", "proxy"}:
        tier = 2
    elif rec >= 60.0 and rent_source_norm in {"provided", "proxy"}:
        tier = 1

    reasons = _extract_reasons(row=row, categories=categories, inputs=inputs, deal_type=deal_type)

    return RecommendedMeta(score=rec, reasons=reasons, tier=tier)


def rerank_recommended(
    items: Iterable[Dict[str, Any]],
    *,
    deal_type: DealType,
    min_tier2: int,
    query_text: str | None = None,
) -> List[Dict[str, Any]]:
    """Enrich + rerank items deterministically.

    Adds: recommended_score, deal_reasons.

    Soft-guardrails:
    - Prefer tier2/tier1 items first.
    - If too few tier2 items exist, relax tier2 threshold indirectly by promoting tier1.
    """

    enriched: List[Tuple[RecommendedMeta, Dict[str, Any]]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        meta = compute_recommended_meta(it, deal_type, query_text=query_text)
        out = dict(it)
        out["recommended_score"] = round(float(meta.score), 2)
        out["deal_reasons"] = list(meta.reasons)
        enriched.append((meta, out))

    # Fallback relax: if we have very few tier2, treat tier1 as tier2 for ordering.
    tier2_count = sum(1 for meta, _ in enriched if meta.tier == 2)
    promote_tier1 = tier2_count < int(min_tier2)

    def sort_key(pair: Tuple[RecommendedMeta, Dict[str, Any]]) -> Tuple[Any, ...]:
        meta, row = pair
        tier = meta.tier
        if promote_tier1 and tier == 1:
            tier = 2

        created_at = row.get("created_at")
        created_at_s = str(created_at or "")

        base_score = _to_float(row.get("score"))
        base_score_f = float(base_score) if base_score is not None else 0.0

        pid = str(row.get("id") or "")
        return (tier, float(meta.score), base_score_f, created_at_s, pid)

    enriched_sorted = sorted(enriched, key=sort_key, reverse=True)
    return [row for _, row in enriched_sorted]
