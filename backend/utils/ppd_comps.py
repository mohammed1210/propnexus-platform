from __future__ import annotations

from datetime import date, datetime
from statistics import median
from typing import Any, Dict, List, Optional

from backend.utils.enrichment_store import safe_select_ppd_sales


def _outward_code(postcode: str | None) -> str | None:
    if not postcode or not isinstance(postcode, str):
        return None
    pc = postcode.strip().upper()
    if not pc:
        return None
    parts = [p for p in pc.split(" ") if p]
    return parts[0] if parts else None


def _num(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        out = float(value)
    except Exception:
        return None
    return out if out == out and out > 0 else None


def _parse_date(value: Any) -> Optional[date]:
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except Exception:
        return None


def _similarity_band(
    comp: Dict[str, Any], subject_property_type: Any = None
) -> tuple[int, str, bool]:
    score = 0
    level = str(comp.get("match_level") or comp.get("match") or "outward").lower()
    if level == "exact":
        score += 45
    elif level == "sector":
        score += 30
    else:
        score += 15

    subject_type = str(subject_property_type or "").strip().lower()
    comp_type = str(comp.get("property_type") or comp.get("type") or "").strip().lower()
    if subject_type and comp_type and subject_type == comp_type:
        score += 20
    elif subject_type and comp_type and subject_type != comp_type:
        score -= 10

    sold_date = _parse_date(comp.get("date") or comp.get("date_of_transfer"))
    if sold_date:
        months = max(0, (date.today() - sold_date).days // 30)
        if months <= 12:
            score += 20
        elif months <= 36:
            score += 12
        else:
            score += 4

    if score >= 70:
        return score, "strong", True
    if score >= 45:
        return score, "usable", True
    return score, "context", False


def build_sold_comp_benchmark(
    comps: List[Dict[str, Any]],
    *,
    subject_price: Optional[float] = None,
    subject_property_type: Any = None,
) -> Dict[str, Any]:
    enriched: List[Dict[str, Any]] = []
    for comp in comps or []:
        if not isinstance(comp, dict):
            continue
        price = _num(comp.get("price"))
        if not price:
            continue
        score, band, included = _similarity_band(comp, subject_property_type)
        enriched.append(
            {
                **comp,
                "price": int(price),
                "similarity_score": score,
                "similarity_band": band,
                "included_in_benchmark": included,
            }
        )

    included = [c for c in enriched if c.get("included_in_benchmark")]
    if len(included) < 3 and enriched:
        included = sorted(
            enriched, key=lambda c: int(c.get("similarity_score") or 0), reverse=True
        )[: min(5, len(enriched))]
        for c in included:
            c["included_in_benchmark"] = True
    prices = [float(c["price"]) for c in included if _num(c.get("price"))]
    med = float(median(prices)) if prices else None
    diff_amount = round(float(subject_price) - med, 0) if subject_price and med else None
    diff_pct = round((diff_amount / med) * 100, 1) if diff_amount is not None and med else None
    confidence = "weak"
    if len(included) >= 5 and any(c.get("match_level") == "exact" for c in included):
        confidence = "strong"
    elif len(included) >= 3:
        confidence = "limited"
    return {
        "similar_sales_count": len(included),
        "median_similar_price": round(med, 0) if med else None,
        "range_low": round(min(prices), 0) if prices else None,
        "range_high": round(max(prices), 0) if prices else None,
        "benchmark_confidence": confidence,
        "subject_vs_median_amount": diff_amount,
        "subject_vs_median_pct": diff_pct,
        "items": enriched,
        "source": "land-registry-ppd",
    }


def get_sold_comps_summary(
    sb: Any,
    *,
    postcode: str | None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Return a compact summary object suitable for embedding in property responses."""

    outward = _outward_code(postcode)
    if not outward:
        return {"count": 0, "median_price": None, "items": []}

    rows = safe_select_ppd_sales(
        sb, postcode_prefix=outward, limit=limit, months_back=36, match_mode="outward"
    )
    prices: List[int] = []
    items: List[Dict[str, Any]] = []

    for r in rows:
        if not isinstance(r, dict):
            continue
        p = r.get("price")
        try:
            pi = int(p)
        except Exception:
            pi = 0
        if pi > 0:
            prices.append(pi)
        items.append(
            {
                "price": pi if pi > 0 else None,
                "date": r.get("date_of_transfer"),
                "postcode": r.get("postcode"),
                "property_type": r.get("property_type"),
                "tenure": r.get("tenure"),
                "new_build": r.get("new_build"),
                "match_level": r.get("match_level") or "outward",
            }
        )

    med: Optional[float] = None
    if prices:
        try:
            med = float(median(prices))
        except Exception:
            med = None

    benchmark = build_sold_comp_benchmark(items)
    return {
        "count": len(items),
        "median_price": round(med, 0) if isinstance(med, (int, float)) else None,
        "items": items,
        "match": "outward_code",
        "outward_code": outward,
        "source": "land-registry-ppd",
        **benchmark,
    }
