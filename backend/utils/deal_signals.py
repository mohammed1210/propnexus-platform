from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


def normalize(text: str | None) -> str:
    if not text:
        return ""
    s = str(text)
    s = s.replace("\u00a0", " ")
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s£]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


_MONEY_RE = re.compile(r"£\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)", re.IGNORECASE)


def _parse_money(value: str | None) -> Optional[int]:
    if not value:
        return None
    m = _MONEY_RE.search(value)
    if not m:
        return None
    digits = m.group(1).replace(",", "")
    try:
        n = int(digits)
    except Exception:
        return None
    return n if n > 0 else None


_WAS_NOW_RE = re.compile(
    r"\bwas\s*(£\s*[0-9]{1,3}(?:,[0-9]{3})+|£\s*[0-9]+)\b[\s\S]{0,80}?\bnow\s*(£\s*[0-9]{1,3}(?:,[0-9]{3})+|£\s*[0-9]+)\b",
    re.IGNORECASE,
)


_SHORT_LEASE_RE = re.compile(
    r"\b(?:lease\s*(?:remaining|left)?\s*)?(\d{2,3})\s*(?:years|yrs)\s*(?:remaining|left)?\b",
    re.IGNORECASE,
)

SHORT_LEASE_THRESHOLD_YEARS = 85


def detect_cash_buyers_only(property_dict: Dict[str, Any]) -> bool:
    """Return True only on explicit cash-only / unmortgageable signals."""
    raw_text, _fields = _collect_text(property_dict)
    norm = normalize(raw_text)
    if not norm:
        return False

    phrases = [
        "cash buyers only",
        "cash buyer only",
        "cash only",
        "no mortgage",
        "not suitable for mortgage",
        "not suitable for a mortgage",
        "unmortgageable",
        "non mortgageable",
        "non-mortgageable",
        "no mortgage finance",
        "mortgage finance not available",
        "no mortgage available",
    ]
    return any(p in norm for p in phrases)


def detect_short_lease(
    property_dict: Dict[str, Any], *, threshold_years: int = SHORT_LEASE_THRESHOLD_YEARS
) -> Tuple[bool, Optional[int]]:
    """Detect short lease.

    Conservative semantics:
    - If an explicit lease years figure is parsed: short iff years <= threshold_years.
    - Otherwise, if strong keywords exist (short lease / lease extension required): short True with years None.
    - If nothing found: False.
    """
    raw_text, _fields = _collect_text(property_dict)
    norm = normalize(raw_text)
    if not norm:
        return False, None

    years: Optional[int] = None
    if "lease" in norm:
        m = _SHORT_LEASE_RE.search(raw_text or "")
        if m:
            try:
                years_i = int(m.group(1))
            except Exception:
                years_i = 0
            if 0 < years_i < 1000:
                years = years_i

    if years is not None:
        return years <= int(threshold_years), years

    keyword_terms = [
        "short lease",
        "lease extension required",
        "lease extension",
    ]
    if any(t in norm for t in keyword_terms):
        return True, None

    return False, None


def _first_str(d: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return None


def _collect_text(property_dict: Dict[str, Any]) -> Tuple[str, Dict[str, str]]:
    title = _first_str(property_dict, ["title", "name", "headline"]) or ""
    description = _first_str(property_dict, ["description", "summary", "details"]) or ""
    key_features_raw = property_dict.get("key_features") or property_dict.get("keyFeatures")
    key_features = ""
    if isinstance(key_features_raw, list):
        key_features = " ".join(str(v) for v in key_features_raw if isinstance(v, str))
    elif isinstance(key_features_raw, str):
        key_features = key_features_raw

    url = _first_str(property_dict, ["url", "listing_url", "raw_url", "link", "href"]) or ""

    # Some rows store raw payloads in data/raw.
    data_obj = property_dict.get("data")
    if isinstance(data_obj, dict):
        raw_obj = data_obj.get("raw") if isinstance(data_obj.get("raw"), dict) else data_obj
        if isinstance(raw_obj, dict):
            title = title or (_first_str(raw_obj, ["title", "name", "headline"]) or "")
            description = description or (
                _first_str(raw_obj, ["description", "summary", "details"]) or ""
            )
            raw_features = raw_obj.get("key_features") or raw_obj.get("keyFeatures")
            if not key_features and isinstance(raw_features, list):
                key_features = " ".join(str(v) for v in raw_features if isinstance(v, str))
            elif not key_features and isinstance(raw_features, str):
                key_features = raw_features
            url = url or (_first_str(raw_obj, ["url", "listing_url", "raw_url", "link"]) or "")

    pieces = [title, description, key_features, url]
    text = "\n".join(p for p in pieces if p)
    return text, {
        "title": title,
        "description": description,
        "key_features": key_features,
        "url": url,
    }


def _source_for_term(fields: Dict[str, str], term: str) -> str:
    needle = normalize(term)
    if not needle:
        return "description"
    for source in ("title", "description", "key_features", "url"):
        haystack = normalize(fields.get(source))
        if needle in haystack:
            return source
    return "description"


def _keyword_label(term: str) -> str:
    clean = normalize(term).replace(" oieo ", " offers in excess of ").strip()
    return clean or term.strip().lower()


def extract_deal_signals(property_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Extract investor-relevant 'deal signals' from a property record.

    Uses only existing text fields (title/description/url and optional data/raw).

    Returns:
      {
        "signals": [str, ...],
        "reasons": [str, ...],  # up to 3
        "confidence": float,    # 0..1
        "matched_terms": {signal: [terms...]}
        "discount_estimate_pct": float|None
      }
    """

    if not isinstance(property_dict, dict):
        return {
            "signals": [],
            "reasons": [],
            "confidence": 0.0,
            "matched_terms": {},
            "discount_estimate_pct": None,
        }

    raw_text, fields = _collect_text(property_dict)
    norm = normalize(raw_text)

    matched_terms: Dict[str, List[str]] = {}

    def has(signal: str, terms: List[str]) -> bool:
        found: List[str] = []
        for t in terms:
            if not t:
                continue
            if t in norm:
                found.append(t)
        if found:
            matched_terms[signal] = sorted(set(found))
            return True
        return False

    signals: List[str] = []

    # Reduced / price drop
    was_now = _WAS_NOW_RE.search(raw_text or "")
    discount_estimate_pct: Optional[float] = None
    if was_now:
        was = _parse_money(was_now.group(1))
        now = _parse_money(was_now.group(2))
        if was and now and was > 0 and now > 0 and now < was:
            discount_estimate_pct = max(0.0, ((was - now) / was) * 100.0)

    reduced_terms = [
        "reduced",
        "price reduced",
        "price drop",
        "reduction",
        "was £",
        "now £",
    ]
    if discount_estimate_pct is not None or has("reduced", reduced_terms):
        signals.append("reduced")
        matched_terms.setdefault("reduced", [])
        if discount_estimate_pct is not None:
            matched_terms["reduced"].append("was/now")

    # Auction
    auction_terms = [
        "auction",
        "modern method of auction",
        "mma",
        "lot ",
        "unless sold prior",
    ]
    if has("auction", auction_terms):
        signals.append("auction")

    # Guide price / offers terms (lower confidence)
    guide_terms = [
        "guide price",
        "offers in excess of",
        "oieo",
        "offers over",
        "offers over ",
    ]
    if has("guide_price", guide_terms):
        signals.append("guide_price")

    # Chain free
    chain_terms = ["chain free", "no onward chain"]
    if has("chain_free", chain_terms):
        signals.append("chain_free")

    # Tenanted
    tenanted_terms = [
        "tenant in situ",
        "tenant",
        "tenanted",
        "currently let",
        "let to",
        "rented",
        "investment opportunity",
    ]
    if has("tenanted", tenanted_terms):
        signals.append("tenanted")

    # Motivated seller
    motivated_terms = [
        "motivated",
        "must sell",
        "urgent sale",
        "priced to sell",
        "quick sale",
    ]
    if has("motivated_seller", motivated_terms):
        signals.append("motivated_seller")

    # Needs refurbishment / modernisation
    refurb_terms = [
        "in need of",
        "modernisation",
        "modernization",
        "refurb",
        "refurbishment",
        "renovation",
        "project",
        "needs updating",
    ]
    if has("needs_refurb", refurb_terms):
        signals.append("needs_refurb")

    # Cash buyers only / unmortgageable
    if detect_cash_buyers_only(property_dict):
        signals.append("cash_buyers_only")
        matched_terms.setdefault("cash_buyers_only", []).append("cash-only")

    # Short lease
    is_short_lease, lease_years = detect_short_lease(property_dict)
    if is_short_lease:
        signals.append("short_lease")
        if isinstance(lease_years, int) and lease_years > 0:
            matched_terms.setdefault("short_lease", []).append(f"{lease_years}y")

    # Below market (only literal)
    if has("below_market", ["below market value", "bmv"]):
        signals.append("below_market")

    if has("probate", ["probate"]):
        signals.append("probate")

    if has(
        "development_potential", ["development potential", "scope to extend", "extension potential"]
    ):
        signals.append("development_potential")

    if has("hmo_potential", ["hmo potential", "suitable for hmo", "potential hmo"]):
        signals.append("hmo_potential")

    if has("planning_permission", ["planning permission", "planning granted", "approved planning"]):
        signals.append("planning_permission")

    if has("vacant_possession", ["vacant possession"]):
        signals.append("vacant_possession")

    if has("repossession", ["repossession", "repossessed"]):
        signals.append("repossession")

    if has("buy_to_let", ["buy to let", "buy-to-let", "btl"]):
        signals.append("buy_to_let")

    if has("high_yield", ["high yield", "high-yield", "strong yield"]):
        signals.append("high_yield")

    if has("strong_rental_demand", ["strong rental demand", "high rental demand"]):
        signals.append("strong_rental_demand")

    # Reasons (ordered by investor appeal)
    reason_map = {
        "auction": "Auction / guide price",
        "reduced": "Price reduced",
        "below_market": "Below market value",
        "needs_refurb": "Needs refurbishment",
        "tenanted": "Tenant in situ",
        "chain_free": "Chain free",
        "motivated_seller": "Motivated seller",
        "cash_buyers_only": "Cash buyers only",
        "short_lease": "Short lease",
        "guide_price": "Guide price / offers",
        "probate": "Probate",
        "development_potential": "Development potential",
        "hmo_potential": "HMO potential",
        "planning_permission": "Planning permission",
        "vacant_possession": "Vacant possession",
        "repossession": "Repossession",
        "buy_to_let": "Buy to let",
        "high_yield": "High yield",
        "strong_rental_demand": "Strong rental demand",
    }
    reason_priority = [
        "auction",
        "reduced",
        "below_market",
        "needs_refurb",
        "tenanted",
        "chain_free",
        "motivated_seller",
        "cash_buyers_only",
        "short_lease",
        "guide_price",
        "probate",
        "vacant_possession",
        "repossession",
        "development_potential",
        "hmo_potential",
        "planning_permission",
        "buy_to_let",
        "high_yield",
        "strong_rental_demand",
    ]

    reasons: List[str] = []
    for sig in reason_priority:
        if sig in signals and reason_map.get(sig):
            label = reason_map[sig]
            if label not in reasons:
                reasons.append(label)
        if len(reasons) >= 3:
            break

    # Confidence per-signal (heuristic, bounded 0..1)
    conf_parts: List[float] = []
    for sig in signals:
        if sig == "auction":
            conf_parts.append(0.9)
        elif sig == "reduced":
            conf_parts.append(0.95 if discount_estimate_pct is not None else 0.75)
        elif sig == "cash_buyers_only":
            conf_parts.append(0.85)
        elif sig == "needs_refurb":
            conf_parts.append(0.65)
        elif sig == "guide_price":
            conf_parts.append(0.45)
        elif sig == "below_market":
            conf_parts.append(0.7)
        elif sig == "short_lease":
            conf_parts.append(0.7)
        elif sig in {"probate", "vacant_possession", "repossession", "planning_permission"}:
            conf_parts.append(0.8)
        elif sig in {
            "development_potential",
            "hmo_potential",
            "buy_to_let",
            "high_yield",
            "strong_rental_demand",
        }:
            conf_parts.append(0.7)
        else:
            conf_parts.append(0.6)

    # Combine without exceeding 1.0
    confidence = 0.0
    for p in conf_parts:
        p = max(0.0, min(1.0, float(p)))
        confidence = 1.0 - (1.0 - confidence) * (1.0 - p)

    # Ensure stable output types
    signals_sorted = sorted(set(signals))

    deal_keywords: List[str] = []
    for terms in matched_terms.values():
        for term in terms:
            label = _keyword_label(str(term))
            if label and label not in deal_keywords:
                deal_keywords.append(label)

    signal_meta: dict[str, tuple[str, str, float]] = {
        "auction": ("auction", "Auction", 0.9),
        "guide_price": ("pricing", "Guide price", 0.55),
        "cash_buyers_only": ("finance", "Cash buyers only", 0.85),
        "needs_refurb": ("value_add", "Modernisation required", 0.9),
        "chain_free": ("seller_position", "Chain free", 0.8),
        "probate": ("seller_position", "Probate", 0.8),
        "reduced": ("pricing", "Reduced", 0.8),
        "motivated_seller": ("seller_position", "Motivated seller", 0.7),
        "short_lease": ("lease", "Short lease", 0.75),
        "development_potential": ("value_add", "Development potential", 0.75),
        "hmo_potential": ("strategy", "HMO potential", 0.75),
        "planning_permission": ("value_add", "Planning permission", 0.85),
        "below_market": ("pricing", "Below market value", 0.7),
        "vacant_possession": ("seller_position", "Vacant possession", 0.8),
        "repossession": ("seller_position", "Repossession", 0.8),
        "tenanted": ("strategy", "Investment opportunity", 0.65),
        "buy_to_let": ("strategy", "Buy to let", 0.7),
        "high_yield": ("yield", "High yield", 0.75),
        "strong_rental_demand": ("rental_demand", "Strong rental demand", 0.75),
    }
    investment_signals: List[Dict[str, Any]] = []
    for sig in reason_priority:
        if sig not in signals_sorted or sig not in signal_meta:
            continue
        signal_type, label, signal_confidence = signal_meta[sig]
        terms = matched_terms.get(sig) or []
        source = _source_for_term(fields, str(terms[0])) if terms else "description"
        investment_signals.append(
            {
                "type": signal_type,
                "label": label,
                "confidence": signal_confidence,
                "source": source,
            }
        )

    return {
        "signals": signals_sorted,
        "reasons": reasons,
        "deal_keywords": deal_keywords,
        "investment_signals": investment_signals,
        "confidence": round(float(confidence), 4),
        "matched_terms": matched_terms,
        "lease_years_remaining": lease_years,
        "discount_estimate_pct": (
            round(float(discount_estimate_pct), 2)
            if isinstance(discount_estimate_pct, (int, float))
            else None
        ),
        "_fields": fields,
    }
