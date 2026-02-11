from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Set

# Conservative keyword patterns (word-boundary where practical).
_RE_COMMERCIAL = re.compile(
    r"\b(commercial|retail|shop|warehouse|office|industrial|mixed\s*use)\b",
    re.IGNORECASE,
)
_RE_COMMERCIAL_UNIT = re.compile(r"\b(commercial\s+unit|retail\s+unit)\b", re.IGNORECASE)

_RE_HMO = re.compile(
    r"\b(hmo|house\s+in\s+multiple\s+occupation|licensed|licen[cs]e|student\s+let|students?)\b",
    re.IGNORECASE,
)
_RE_SA = re.compile(
    r"\b(airbnb|short\s*let|serviced\s+accommodation|holiday\s+let|booking\.com)\b",
    re.IGNORECASE,
)
_RE_REFURB = re.compile(
    r"\b(refurb|refurbishment|moderni[sz]ation|renovat(e|ion)|project|updating\s+required|needs\s+work)\b",
    re.IGNORECASE,
)
_RE_CASH_ONLY = re.compile(r"\b(cash\s+buyers?\s+only|auction)\b", re.IGNORECASE)


_ALLOWED_TAGS = {"HMO", "BTL", "SA", "BRR", "Flip", "Commercial"}


def _safe_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return str(v)


def _norm_property_type_key(value: Any) -> str:
    """Normalize API property_type labels into a compact key.

    Examples:
    - "Terraced" -> "terraced"
    - "Semi-detached" -> "semi-detached"
    - "Flat/Apartment" -> "flat"
    """

    s = _safe_str(value).strip().lower()
    if not s:
        return ""
    if "flat" in s or "apartment" in s:
        return "flat"
    if "studio" in s:
        return "studio"
    if "maisonette" in s:
        return "maisonette"
    if "bungalow" in s:
        return "bungalow"
    if "semi" in s and "detach" in s:
        return "semi-detached"
    if "detach" in s:
        return "detached"
    if "terrac" in s:
        return "terraced"
    if "commercial" in s:
        return "commercial"
    if "land" in s or "plot" in s:
        return "land"
    return s


def _collect_text(p: Dict[str, Any]) -> str:
    # Prefer common listing fields. Keep this small + deterministic.
    parts = []
    for k in ("title", "description", "summary", "location", "address", "source"):
        v = p.get(k)
        if v not in (None, ""):
            parts.append(_safe_str(v))
    return " ".join(parts)


def _to_int(v: Any) -> int:
    try:
        if v is None or isinstance(v, bool):
            return 0
        return int(float(v))
    except Exception:
        return 0


def _to_float_or_none(v: Any) -> float | None:
    try:
        if v is None or isinstance(v, bool):
            return None
        return float(v)
    except Exception:
        return None


def _to_signal_set(value: Any) -> Set[str]:
    if value is None:
        return set()
    if isinstance(value, str):
        return {s.strip().lower() for s in value.split(",") if s.strip()}
    if isinstance(value, Iterable) and not isinstance(value, (bytes, dict)):
        out: Set[str] = set()
        for s in value:
            if isinstance(s, str) and s.strip():
                out.add(s.strip().lower())
        return out
    return set()


def classify_investment_types(p: Dict[str, Any]) -> Set[str]:
    """Deterministic, conservative tagging.

    Returns a set like {"BTL", "BRR"}. Designed to be safe for API-read usage:
    - No external calls
    - Tolerates missing/messy fields
    - Allows multiple tags
    """

    text = _collect_text(p)
    tags: Set[str] = set()

    pt_key = _norm_property_type_key(p.get("property_type"))
    beds = _to_int(p.get("bedrooms") if p.get("bedrooms") is not None else p.get("beds"))

    deal_signals = _to_signal_set(p.get("deal_signals"))
    discount = _to_float_or_none(p.get("discount_estimate_pct"))

    # Commercial
    if pt_key == "commercial" or _RE_COMMERCIAL.search(text) or _RE_COMMERCIAL_UNIT.search(text):
        tags.add("Commercial")

    # HMO
    if _RE_HMO.search(text) or _safe_str(p.get("investment_type")).strip().upper() == "HMO":
        tags.add("HMO")
    elif beds >= 5 and pt_key in {"terraced", "semi-detached", "detached"}:
        # Soft signal only (still deterministic)
        tags.add("HMO")

    # Serviced Accommodation
    if _RE_SA.search(text):
        tags.add("SA")

    refurbish_signal = (
        _RE_REFURB.search(text) is not None
        or _RE_CASH_ONLY.search(text) is not None
        or "needs_refurb" in deal_signals
        or "cash_buyers_only" in deal_signals
        or "auction" in deal_signals
    )

    if refurbish_signal:
        tags.add("Flip")

    # BRR = refurb + meaningful discount / reduction
    if refurbish_signal and (
        (discount is not None and discount >= 8.0) or ("reduced" in deal_signals)
    ):
        tags.add("BRR")

    # BTL fallback (residential-ish only)
    residentialish = pt_key in {
        "",
        "flat",
        "studio",
        "maisonette",
        "bungalow",
        "terraced",
        "semi-detached",
        "detached",
    }
    if "Commercial" not in tags and residentialish and not tags:
        tags.add("BTL")

    # Ensure we never emit unknown tags.
    return {t for t in tags if t in _ALLOWED_TAGS}
