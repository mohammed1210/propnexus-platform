# backend/utils/property_contract.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# A canonical list of keys we expect every property dict to contain.
# This is intentionally "superset-friendly" so adding fields later is safe.
REQUIRED_KEYS: Tuple[str, ...] = (
    "external_id",
    "source",
    "title",
    "location",
    "price",
    "bedrooms",
    "bathrooms",
    "property_type",
    "description",
    "image_url",
    "image_urls",
    "latitude",
    "longitude",
    "raw_url",
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_required_keys(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure all REQUIRED_KEYS exist on the dict (even if None).
    This makes downstream scoring + UI stable.
    """
    out = dict(p)
    for k in REQUIRED_KEYS:
        out.setdefault(k, None)
    return out


def coerce_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        s = str(value).strip()
        if not s:
            return None
        # keep only digits
        digits = "".join(ch for ch in s if ch.isdigit())
        if not digits:
            return None
        return int(digits)
    except Exception:
        return None


def coerce_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, float):
        return value
    if isinstance(value, int):
        return float(value)
    try:
        s = str(value).strip()
        if not s:
            return None
        # allow minus and dot
        allowed = []
        for ch in s:
            if ch.isdigit() or ch in ".-":
                allowed.append(ch)
        cleaned = "".join(allowed)
        return float(cleaned) if cleaned not in ("", ".", "-", "-.") else None
    except Exception:
        return None


def normalize_property_type(value: Any) -> Optional[str]:
    """
    Normalize to a compact set. If unknown, return None.
    """
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s:
        return None

    # order matters: studio before flat
    if "studio" in s:
        return "studio"
    if "flat" in s or "apartment" in s:
        return "flat"
    if "semi-detached" in s or "semi detached" in s:
        return "semi-detached"
    if "detached" in s and "semi" not in s:
        return "detached"
    if "terraced" in s:
        return "terraced"
    if "bungalow" in s:
        return "bungalow"
    if "maisonette" in s:
        return "maisonette"
    if "cottage" in s:
        return "cottage"
    if "house" in s:
        return "house"

    return None


def normalize_image_urls(value: Any) -> List[str]:
    """
    Ensure image_urls is a list[str] with unique items, preserving order.
    """
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]

    if not isinstance(value, list):
        return []

    cleaned: List[str] = []
    seen = set()
    for item in value:
        if not item:
            continue
        u = str(item).strip()
        if not u:
            continue
        if u not in seen:
            cleaned.append(u)
            seen.add(u)
    return cleaned


def compute_ai_ready(p: Dict[str, Any]) -> bool:
    """
    Conservative rule: we only label AI-ready if core investment fields exist.
    This is not stored in DB unless you decide to later.
    """
    price = p.get("price")
    beds = p.get("bedrooms")
    lat = p.get("latitude")
    lng = p.get("longitude")
    title = p.get("title")
    location = p.get("location")
    source = p.get("source")
    external_id = p.get("external_id")

    if not source or not external_id:
        return False
    if not title or not location:
        return False
    if price is None:
        return False
    if beds is None:
        return False
    if lat is None or lng is None:
        return False

    return True
