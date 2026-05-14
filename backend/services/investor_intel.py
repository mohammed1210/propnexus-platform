from __future__ import annotations

from statistics import median
from typing import Any, Dict, List, Optional

from backend.services.providers import get_comps_from_provider
from backend.utils.ppd_comps import build_sold_comp_benchmark

YIELD_TARGETS = (6, 7, 8)


def _num(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        out = float(value)
    except Exception:
        return None
    return out if out == out and out > 0 else None


def _price(row: Dict[str, Any]) -> Optional[float]:
    return _num(row.get("asking_price")) or _num(row.get("price"))


def _data(row: Dict[str, Any]) -> Dict[str, Any]:
    return row.get("data") if isinstance(row.get("data"), dict) else {}


def rent_evidence_summary(
    row: Dict[str, Any], comps: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    data = _data(row)
    direct = _num(
        row.get("rent_monthly") or row.get("rent_pcm") or row.get("monthly_rent") or row.get("rent")
    )
    rent_conf = str(row.get("rent_confidence") or data.get("rent_confidence") or "").lower()
    real_rent = (
        direct
        if rent_conf in {"provided", "verified", "actual", "landlord", "agent", "comps"}
        else None
    )

    rents = (comps or {}).get("rents") if isinstance(comps, dict) else []
    rent_values = [
        float(r.get("rent_monthly") or r.get("price"))
        for r in rents or []
        if isinstance(r, dict)
        and str(r.get("source") or "") != "derived_internal_estimate"
        and _num(r.get("rent_monthly") or r.get("price"))
    ]

    if real_rent:
        return {
            "monthly_rent": round(real_rent, 2),
            "source": rent_conf or "provided",
            "quality": "strong",
            "is_real_rent_evidence": True,
            "usable_rent_comps": len(rent_values),
        }
    if rent_values:
        return {
            "monthly_rent": round(float(median(rent_values)), 2),
            "range_low": round(min(rent_values), 2),
            "range_high": round(max(rent_values), 2),
            "source": "real_rental_listing_evidence",
            "quality": "medium" if len(rent_values) >= 3 else "limited",
            "is_real_rent_evidence": True,
            "usable_rent_comps": len(rent_values),
        }

    estimated = _num(
        row.get("estimated_rent_pcm")
        or row.get("rent_estimate_monthly")
        or data.get("estimated_rent_pcm")
        or data.get("rent_estimate_monthly")
    )
    if estimated:
        return {
            "monthly_rent": round(estimated, 2),
            "source": "derived_internal_estimate",
            "quality": "estimate_only",
            "is_real_rent_evidence": False,
            "usable_rent_comps": 0,
        }
    return {
        "monthly_rent": None,
        "source": "unavailable",
        "quality": "missing",
        "is_real_rent_evidence": False,
        "usable_rent_comps": 0,
    }


def _sanitize_rent_comp(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rent = _num(row.get("rent_monthly") or row.get("price"))
    if not rent:
        return None
    source = str(row.get("source") or "rental_listing").strip()
    if source == "derived_internal_estimate":
        return None

    out: Dict[str, Any] = {
        "rent_monthly": round(rent, 2),
        "source": source or "rental_listing",
    }
    for src, dest in (
        ("title", "title"),
        ("address", "short_address"),
        ("postcode", "postcode"),
        ("location", "location"),
        ("property_type", "property_type"),
        ("type", "property_type"),
        ("date", "date"),
        ("updated_at", "date"),
        ("source_url", "source_url"),
    ):
        value = row.get(src)
        if value not in (None, "") and out.get(dest) in (None, ""):
            out[dest] = value
    bedrooms = row.get("bedrooms")
    if bedrooms not in (None, ""):
        out["bedrooms"] = bedrooms
    return out


def rent_comps_payload(comps: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    rents = (comps or {}).get("rents") if isinstance(comps, dict) else []
    sanitized: List[Dict[str, Any]] = []
    for item in rents or []:
        if not isinstance(item, dict):
            continue
        clean = _sanitize_rent_comp(item)
        if clean:
            sanitized.append(clean)
        if len(sanitized) >= 6:
            break

    values = [float(item["rent_monthly"]) for item in sanitized if _num(item.get("rent_monthly"))]
    confidence = "missing"
    if len(values) >= 5:
        confidence = "strong"
    elif len(values) >= 3:
        confidence = "moderate"
    elif values:
        confidence = "limited"

    return {
        "items": sanitized,
        "count": len(sanitized),
        "range_low": round(min(values), 2) if values else None,
        "range_high": round(max(values), 2) if values else None,
        "median_rent": round(float(median(values)), 2) if values else None,
        "confidence": confidence,
    }


def offer_calculations(
    asking_price: Optional[float], monthly_rent: Optional[float]
) -> Dict[str, Any]:
    rent_required = {}
    target_purchase_price = {}
    for target in YIELD_TARGETS:
        rent_required[str(target)] = (
            round(((asking_price or 0) * (target / 100.0)) / 12.0, 2) if asking_price else None
        )
        target_purchase_price[str(target)] = (
            round((monthly_rent * 12.0) / (target / 100.0), 0) if monthly_rent else None
        )
    gap_to_7 = None
    if asking_price and target_purchase_price.get("7"):
        gap_to_7 = round(asking_price - float(target_purchase_price["7"]), 0)
    return {
        "yield_targets": list(YIELD_TARGETS),
        "rent_required_at_asking": rent_required,
        "target_purchase_price_from_rent": target_purchase_price,
        "price_gap_to_7pct_yield": gap_to_7,
    }


def listing_history_summary(row: Dict[str, Any]) -> Dict[str, Any]:
    data = _data(row)
    return {
        "first_seen_at": row.get("first_seen_at")
        or data.get("first_seen_at")
        or row.get("created_at"),
        "last_seen_at": row.get("last_seen_at")
        or data.get("last_seen_at")
        or row.get("updated_at"),
        "initial_price": _num(row.get("initial_price") or data.get("initial_price")),
        "previous_price": _num(row.get("previous_price") or data.get("previous_price")),
        "last_price_change_at": row.get("last_price_change_at") or data.get("last_price_change_at"),
        "price_change_count": int(
            _num(row.get("price_change_count") or data.get("price_change_count")) or 0
        ),
        "price_history": (
            row.get("price_history")
            if isinstance(row.get("price_history"), list)
            else data.get("price_history") if isinstance(data.get("price_history"), list) else []
        ),
    }


def build_investor_intel_payload(
    row: Dict[str, Any], *, comps: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    asking = _price(row)
    postcode = str(row.get("postcode") or "").strip()
    comps_payload = (
        comps
        if isinstance(comps, dict)
        else (get_comps_from_provider(postcode) if postcode else {})
    )
    comp_benchmark = build_sold_comp_benchmark(
        comps_payload.get("sales") if isinstance(comps_payload, dict) else [],
        subject_price=asking,
        subject_property_type=row.get("property_type"),
    )
    rent = rent_evidence_summary(row, comps_payload)
    rent_comps = rent_comps_payload(comps_payload)
    monthly_rent = rent.get("monthly_rent") if rent.get("is_real_rent_evidence") else None
    offer = offer_calculations(asking, _num(monthly_rent))

    gross_yield = (
        round((_num(monthly_rent) * 12 / asking) * 100, 2)
        if asking and _num(monthly_rent)
        else None
    )
    if not monthly_rent and _num(row.get("yield_percent")):
        gross_yield = None

    if not _num(monthly_rent):
        conclusion = "Insufficient rent evidence to calculate a reliable offer target."
    elif offer.get("price_gap_to_7pct_yield") and offer["price_gap_to_7pct_yield"] > 0:
        target = offer["target_purchase_price_from_rent"].get("7")
        conclusion = f"Income case improves materially below £{int(target):,}."
    elif (
        comp_benchmark.get("subject_vs_median_pct") is not None
        and comp_benchmark.get("subject_vs_median_pct") <= 0
    ):
        conclusion = "Asking price sits below the comparable sold median, subject to comp quality."
    else:
        conclusion = "Offer target depends on verified rent and comparable-sales quality."

    return {
        "property_id": row.get("id"),
        "asking_price": asking,
        "current_monthly_rent": rent.get("monthly_rent"),
        "rent_evidence": rent,
        "rent_comps": rent_comps["items"],
        "rent_comp_count": rent_comps["count"],
        "rent_comp_range_low": rent_comps["range_low"],
        "rent_comp_range_high": rent_comps["range_high"],
        "rent_comp_median": rent_comps["median_rent"],
        "rent_comp_confidence": rent_comps["confidence"],
        "gross_yield_percent": gross_yield,
        "sold_comp_benchmark": comp_benchmark,
        "comp_evidence_quality": comp_benchmark.get("benchmark_confidence"),
        "offer_intelligence": offer,
        "listing_history": listing_history_summary(row),
        "strategy_viability": {
            "primary_strategy": row.get("investment_type"),
            "summary": "Strategy case is evidence-led; verify rent, comps, condition, legal pack and finance timing before offer.",
        },
        "conclusion": conclusion,
    }
