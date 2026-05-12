from __future__ import annotations

import re
from datetime import datetime, timezone
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Tuple

from backend.utils.deal_signals import extract_deal_signals

TOP_DEAL_VERSION = "top-deal-v2"
LUXURY_OUTLIER_PRICE = 1_500_000


def _to_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    if isinstance(value, str):
        s = value.strip().replace("£", "").replace(",", "")
        s = re.sub(r"[^0-9.\-]", "", s)
        try:
            n = float(s)
        except Exception:
            return None
        return n if n > 0 else None
    return None


def _to_int(value: Any) -> Optional[int]:
    n = _to_float(value)
    return int(round(n)) if n is not None else None


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _extract_price(row: Dict[str, Any]) -> Optional[int]:
    for key in ("price", "asking_price", "displayPrice", "display_price"):
        n = _to_int(row.get(key))
        if n:
            return n
    data = row.get("data")
    if isinstance(data, dict):
        raw = data.get("raw") if isinstance(data.get("raw"), dict) else data
        if isinstance(raw, dict):
            for key in ("price", "displayPrice", "display_price"):
                n = _to_int(raw.get(key))
                if n:
                    return n
    return None


def _extract_source_url(row: Dict[str, Any]) -> str:
    for key in (
        "source_url",
        "original_listing_url",
        "listing_url",
        "property_url",
        "external_url",
        "original_url",
        "rightmove_url",
        "zoopla_url",
        "onthemarket_url",
        "url",
        "raw_url",
    ):
        v = row.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_images(row: Dict[str, Any]) -> List[str]:
    raw = row.get("image_urls")
    if isinstance(raw, list):
        return [u.strip() for u in raw if isinstance(u, str) and u.strip()]
    if isinstance(row.get("imageurl"), str) and row["imageurl"].strip():
        return [row["imageurl"].strip()]
    return []


def _get_rent_confidence(row: Dict[str, Any]) -> str:
    for key in ("rent_confidence", "rental_confidence"):
        v = row.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    data = row.get("data")
    if isinstance(data, dict):
        for key in ("rent_confidence", "rental_confidence"):
            v = data.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip().lower()
    breakdown = row.get("score_breakdown")
    inputs = breakdown.get("inputs") if isinstance(breakdown, dict) else None
    if isinstance(inputs, dict):
        src = inputs.get("rent_source")
        if isinstance(src, str):
            return src.strip().lower()
    return "missing"


def _has_real_rent_evidence(row: Dict[str, Any]) -> bool:
    confidence = _get_rent_confidence(row)
    if confidence in {"provided", "verified", "actual", "landlord", "agent", "comps"}:
        return True
    # Numeric rent alone is only evidence when a feed/source explicitly says it is provided.
    return False


def _extract_sold_comp_median(
    row: Dict[str, Any], sold_comps: Optional[Dict[str, Any]] = None
) -> Tuple[Optional[float], int]:
    comp_obj = sold_comps if isinstance(sold_comps, dict) else None
    if comp_obj is None:
        data = row.get("data")
        if isinstance(data, dict) and isinstance(data.get("sold_comps"), dict):
            comp_obj = data.get("sold_comps")
        elif isinstance(row.get("sold_comps"), dict):
            comp_obj = row.get("sold_comps")
    if not comp_obj:
        return None, 0
    med = _to_float(
        comp_obj.get("median_similar_price")
        or comp_obj.get("median_price")
        or comp_obj.get("median_sold_price")
    )
    count = _to_int(comp_obj.get("similar_sales_count") or comp_obj.get("count")) or 0
    if med is None:
        items = comp_obj.get("items")
        if isinstance(items, list):
            prices = [_to_float((it or {}).get("price")) for it in items if isinstance(it, dict)]
            prices = [p for p in prices if p]
            if prices:
                med = float(median(prices))
                count = max(count, len(prices))
    return med, count


def _compute_discount_vs_comps(
    price: Optional[int], median_sold: Optional[float], comp_count: int
) -> Optional[float]:
    if not price or not median_sold or comp_count < 3 or median_sold <= 0:
        return None
    discount = ((median_sold - price) / median_sold) * 100.0
    return discount if discount > 0 else None


def _parse_dt(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _days_since(value: Any) -> Optional[int]:
    dt = _parse_dt(value)
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt.astimezone(timezone.utc)
    return max(0, int(delta.days))


def _listing_history(row: Dict[str, Any]) -> Dict[str, Any]:
    data = row.get("data") if isinstance(row.get("data"), dict) else {}
    history = row.get("price_history")
    if not isinstance(history, list):
        history = data.get("price_history") if isinstance(data.get("price_history"), list) else []
    price_change_count = (
        _to_int(row.get("price_change_count") or data.get("price_change_count")) or 0
    )
    initial = _to_float(row.get("initial_price") or data.get("initial_price"))
    previous = _to_float(row.get("previous_price") or data.get("previous_price"))
    current = _extract_price(row)
    last_change = row.get("last_price_change_at") or data.get("last_price_change_at")
    first_seen = row.get("first_seen_at") or data.get("first_seen_at") or row.get("created_at")
    days_tracked = _days_since(first_seen)

    latest_reduction_amount: Optional[float] = None
    latest_reduction_pct: Optional[float] = None
    if previous and current and previous > current:
        latest_reduction_amount = previous - current
        latest_reduction_pct = ((previous - current) / previous) * 100.0
    elif history:
        for item in reversed(history):
            if not isinstance(item, dict):
                continue
            old = _to_float(item.get("old_price"))
            new = _to_float(item.get("new_price"))
            if old and new and old > new:
                latest_reduction_amount = old - new
                latest_reduction_pct = ((old - new) / old) * 100.0
                break

    total_reduction_pct: Optional[float] = None
    if initial and current and initial > current:
        total_reduction_pct = ((initial - current) / initial) * 100.0

    return {
        "first_seen_at": first_seen,
        "last_seen_at": row.get("last_seen_at") or data.get("last_seen_at"),
        "days_tracked": days_tracked,
        "initial_price": initial,
        "previous_price": previous,
        "last_price_change_at": last_change,
        "price_change_count": price_change_count,
        "latest_reduction_amount": latest_reduction_amount,
        "latest_reduction_pct": latest_reduction_pct,
        "total_reduction_pct": total_reduction_pct,
        "price_history": history[:20],
    }


def _is_luxury_outlier(row: Dict[str, Any], price: Optional[int] = None) -> bool:
    p = price or _extract_price(row) or 0
    if p >= LUXURY_OUTLIER_PRICE:
        return True
    text = " ".join(
        str(row.get(k) or "") for k in ("title", "description", "property_type")
    ).lower()
    return (
        any(term in text for term in ("penthouse", "mansion", "country estate", "luxury"))
        and p >= 900_000
    )


def _dedupe_reasons(reasons: Iterable[str], limit: int = 5) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for reason in reasons:
        s = str(reason or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= limit:
            break
    return out


def _search_metadata(row: Dict[str, Any]) -> Dict[str, Any]:
    data = row.get("data")
    meta: Dict[str, Any] = {}
    if isinstance(data, dict) and isinstance(data.get("search_metadata"), dict):
        meta.update(data.get("search_metadata") or {})
    if isinstance(row.get("search_metadata"), dict):
        meta.update(row.get("search_metadata") or {})
    return meta


def score_top_deal_candidate(
    row: Dict[str, Any], *, sold_comps: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Score a listing for discovery/ranking using only explainable evidence.

    This is separate from the AI Deal Score. It rewards scrape intent, explicit listing
    signals, photos, and verified sold-comps discounts. It never labels a property BMV
    from proxy rent/ROI data.
    """
    if not isinstance(row, dict):
        row = {}

    score = 0.0
    reasons: List[str] = []
    evidence: Dict[str, Any] = {"version": TOP_DEAL_VERSION}
    evidence_categories: set[str] = set()
    hard_signal_count = 0
    hard_reasons: List[str] = []

    price = _extract_price(row)
    source_url = _extract_source_url(row)
    images = _extract_images(row)
    meta = _search_metadata(row)
    signals = extract_deal_signals(row)
    signal_set = set(signals.get("signals") or []) if isinstance(signals, dict) else set()

    if price:
        score += 8
        evidence["has_price"] = True
        evidence_categories.add("data_quality")
    if source_url:
        score += 8
        evidence["has_source_url"] = True
        evidence_categories.add("data_quality")
    if images:
        image_points = min(10, 3 + len(images))
        score += image_points
        evidence["image_count"] = len(images)
        evidence_categories.add("data_quality")

    strategy = str(meta.get("strategy") or meta.get("intent") or "").lower()
    sort_label = str(meta.get("sort_label") or meta.get("sort") or "").lower()
    if strategy == "top_deal" or sort_label in {
        "lowest_price",
        "oldest",
        "reduced",
        "recently_reduced",
        "auction",
    }:
        score += 8
        reasons.append("Found via investor discovery search pass")
        evidence["search_metadata"] = meta
        evidence_categories.add("search_pass")
    if sort_label in {"reduced", "recently_reduced"}:
        score += 5
        reasons.append("Portal search marked it as reduced")
        evidence_categories.add("listing_signal")
    if sort_label == "oldest":
        score += 5
        reasons.append("Older listing pass can reveal stale stock")
        evidence_categories.add("listing_signal")
    if sort_label == "lowest_price":
        score += 5
        reasons.append("Low-price search pass surfaced it")
        evidence_categories.add("listing_signal")

    signal_weights = {
        "reduced": (12, "Listing text indicates a price reduction"),
        "auction": (10, "Auction wording detected"),
        "cash_buyers_only": (10, "Cash-buyer / unmortgageable signal detected"),
        "needs_refurb": (9, "Refurbishment or modernisation signal detected"),
        "motivated_seller": (8, "Motivated-seller wording detected"),
        "chain_free": (5, "Chain-free signal detected"),
        "tenanted": (5, "Tenanted/income signal detected"),
        "short_lease": (4, "Short-lease signal needs careful review"),
        "guide_price": (3, "Guide/offers wording detected"),
    }
    for signal, (points, reason) in signal_weights.items():
        if signal in signal_set:
            score += points
            reasons.append(reason)
            evidence_categories.add("listing_signal")
    if isinstance(signals, dict):
        evidence["deal_signals"] = signals.get("signals") or []

    history = _listing_history(row)
    evidence["listing_history"] = history
    if history.get("latest_reduction_amount"):
        amount = int(round(float(history["latest_reduction_amount"])))
        pct = history.get("latest_reduction_pct")
        score += 16 if float(pct or 0) >= 8 else 11
        hard_signal_count += 1
        evidence_categories.add("listing_history")
        reason = f"PropNexus verified a £{amount:,} price reduction"
        hard_reasons.append(reason)
        reasons.insert(0, reason)
    days_tracked = history.get("days_tracked")
    if isinstance(days_tracked, int) and days_tracked >= 60:
        stale_points = 8 if days_tracked >= 120 else 5
        score += stale_points
        evidence_categories.add("listing_history")
        reasons.append(
            f"Tracked for {days_tracked} days; stale-stock diligence may help negotiation"
        )

    median_sold, comp_count = _extract_sold_comp_median(row, sold_comps)
    discount = _compute_discount_vs_comps(price, median_sold, comp_count)
    bmv_evidence = False
    if discount is not None:
        evidence["sold_comps"] = {
            "count": comp_count,
            "median_price": median_sold,
            "discount_vs_comps_pct": round(discount, 1),
        }
        if discount >= 20:
            score += 25
            bmv_evidence = True
            hard_signal_count += 1
            evidence_categories.add("sold_comps")
            reason = f"Asking price is {round(discount)}% below comparable sold-comps median"
            hard_reasons.append(reason)
            reasons.insert(0, reason)
        elif discount >= 10:
            score += 15
            bmv_evidence = True
            hard_signal_count += 1
            evidence_categories.add("sold_comps")
            reason = f"Asking price is {round(discount)}% below comparable sold-comps median"
            hard_reasons.append(reason)
            reasons.insert(0, reason)
        elif discount >= 5:
            score += 7
            evidence_categories.add("sold_comps")
            reasons.insert(0, "Asking price is modestly below comparable sold-comps median")

    rent_evidence = _has_real_rent_evidence(row)
    evidence["rent_evidence"] = _get_rent_confidence(row)
    y = _to_float(row.get("yield_percent"))
    roi = _to_float(row.get("roi_percent"))
    if rent_evidence and y and y >= 7:
        score += 8
        hard_signal_count += 1
        evidence_categories.add("rent_evidence")
        reason = f"Real rent evidence supports {round(y, 1)}% gross yield"
        hard_reasons.append(reason)
        reasons.append(reason)
    if rent_evidence and roi and roi >= 12:
        score += 6
        reasons.append("Verified rent evidence supports ROI")
        evidence_categories.add("rent_evidence")

    if "auction" in signal_set and (
        {"needs_refurb", "guide_price"} & signal_set
        or discount
        or history.get("latest_reduction_amount")
    ):
        hard_signal_count += 1
        evidence_categories.add("listing_signal")
        hard_reasons.append("Auction route combined with value/negotiation signal")
    if "needs_refurb" in signal_set and (
        discount or history.get("latest_reduction_amount") or source_url
    ):
        hard_signal_count += 1
        evidence_categories.add("listing_signal")
        hard_reasons.append("Value-add wording combined with supporting data quality")

    if _is_luxury_outlier(row, price):
        score -= 15
        evidence["luxury_outlier"] = True
        reasons.append("Higher-priced outlier: review manually before prioritising")

    if not source_url:
        score -= 10
    if not price:
        score -= 12
    if not images:
        score -= 5

    score_int = int(round(_clamp(score)))
    categories = sorted(evidence_categories)
    has_min_evidence = len(categories) >= 2
    has_hard_signal = hard_signal_count >= 1
    tier = "standard"
    if score_int >= 75 and has_min_evidence and has_hard_signal:
        tier = "prime"
    elif score_int >= 60 and has_min_evidence and has_hard_signal:
        tier = "strong"
    elif 45 <= score_int <= 59 or (score_int >= 60 and not (has_min_evidence and has_hard_signal)):
        tier = "watchlist"

    evidence["hard_signal_count"] = hard_signal_count
    evidence["evidence_categories"] = categories
    evidence["strongest_reason"] = (
        hard_reasons[0]
        if hard_reasons
        else (_dedupe_reasons(reasons, limit=1)[0] if reasons else None)
    )
    evidence["confidence_level"] = (
        "high" if tier in {"prime", "strong"} else "medium" if tier == "watchlist" else "low"
    )

    return {
        "score": score_int,
        "tier": tier,
        "reasons": _dedupe_reasons(reasons, limit=5),
        "evidence": evidence,
        "bmv_evidence": bmv_evidence,
        "discount_vs_comps_pct": round(discount, 1) if discount is not None else None,
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }


def apply_top_deal_ranking(
    row: Dict[str, Any], *, sold_comps: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    ranked = score_top_deal_candidate(row, sold_comps=sold_comps)
    out = dict(row or {})
    out["top_deal_score"] = ranked["score"]
    out["top_deal_tier"] = ranked["tier"]
    out["top_deal_reasons"] = ranked["reasons"]
    data = out.get("data")
    if not isinstance(data, dict):
        data = {} if data in (None, "") else {"raw": data}
    data["top_deal"] = ranked
    if "search_metadata" in out and isinstance(out.get("search_metadata"), dict):
        data["search_metadata"] = out.get("search_metadata")
    out["data"] = data
    return out


def rank_top_deal_candidates(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ranked = [apply_top_deal_ranking(r) for r in rows if isinstance(r, dict)]
    return sorted(
        ranked,
        key=lambda r: (
            (
                2
                if r.get("top_deal_tier") == "prime"
                else 1 if r.get("top_deal_tier") == "strong" else 0
            ),
            int(r.get("top_deal_score") or 0),
            1 if _extract_source_url(r) else 0,
            _extract_price(r) or 0,
        ),
        reverse=True,
    )
