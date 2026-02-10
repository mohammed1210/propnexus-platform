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
    r"\b(?:lease\s*)?(\d{2,3})\s*years\s*(?:remaining|left)?\b",
    re.IGNORECASE,
)


def _first_str(d: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return None


def _collect_text(property_dict: Dict[str, Any]) -> Tuple[str, Dict[str, str]]:
    title = _first_str(property_dict, ["title", "name", "headline"]) or ""
    description = _first_str(property_dict, ["description", "summary", "details"]) or ""

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
            url = url or (_first_str(raw_obj, ["url", "listing_url", "raw_url", "link"]) or "")

    pieces = [title, description, url]
    text = "\n".join(p for p in pieces if p)
    return text, {"title": title, "description": description, "url": url}


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

    # Cash buyers / unmortgageable
    cash_terms = [
        "cash buyers only",
        "cash buyer only",
        "cash only",
        "unmortgageable",
        "non mortgageable",
        "non-mortgageable",
    ]
    if has("cash_buyers", cash_terms):
        signals.append("cash_buyers")

    # Short lease
    short_lease = False
    if "lease" in norm:
        m = _SHORT_LEASE_RE.search(raw_text or "")
        if m:
            try:
                years = int(m.group(1))
            except Exception:
                years = 0
            if 0 < years < 90:
                short_lease = True
                matched_terms.setdefault("short_lease", []).append(f"{years}y")
    if short_lease:
        signals.append("short_lease")

    # Below market (only literal)
    if has("below_market", ["below market value", "bmv"]):
        signals.append("below_market")

    # Reasons (ordered by investor appeal)
    reason_map = {
        "auction": "Auction / guide price",
        "reduced": "Price reduced",
        "below_market": "Below market value",
        "needs_refurb": "Needs refurbishment",
        "tenanted": "Tenant in situ",
        "chain_free": "Chain free",
        "motivated_seller": "Motivated seller",
        "cash_buyers": "Cash buyers only",
        "short_lease": "Short lease",
        "guide_price": "Guide price / offers",
    }
    reason_priority = [
        "auction",
        "reduced",
        "below_market",
        "needs_refurb",
        "tenanted",
        "chain_free",
        "motivated_seller",
        "cash_buyers",
        "short_lease",
        "guide_price",
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
        elif sig == "cash_buyers":
            conf_parts.append(0.85)
        elif sig == "needs_refurb":
            conf_parts.append(0.65)
        elif sig == "guide_price":
            conf_parts.append(0.45)
        elif sig == "below_market":
            conf_parts.append(0.7)
        elif sig == "short_lease":
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

    return {
        "signals": signals_sorted,
        "reasons": reasons,
        "confidence": round(float(confidence), 4),
        "matched_terms": matched_terms,
        "discount_estimate_pct": (
            round(float(discount_estimate_pct), 2)
            if isinstance(discount_estimate_pct, (int, float))
            else None
        ),
        "_fields": fields,
    }
