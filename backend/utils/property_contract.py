# backend/utils/property_contract.py
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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


# -----------------------------
# Time helpers
# -----------------------------
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -----------------------------
# URL validation (kept lightweight, no imports from validation.py to avoid cycles)
# -----------------------------
def is_valid_url(url: Optional[str]) -> bool:
    if not url or not isinstance(url, str):
        return False
    try:
        r = urlparse(url.strip())
        if not (r.scheme and r.netloc):
            return False
        return r.scheme in {"http", "https"}
    except Exception:
        return False


def is_valid_image_url(url: Optional[str]) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if u.startswith("data:image/"):
        return True
    if not is_valid_url(u):
        return False

    lower = u.lower()
    if lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg")):
        return True

    # Common CDN / path hints for image assets
    patterns = ("/image", "/photo", "/picture", "/media", "/upload", "cdn", "cloudfront")
    return any(p in lower for p in patterns)


# -----------------------------
# Canonical shape
# -----------------------------
def ensure_required_keys(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure all REQUIRED_KEYS exist on the dict (even if None).
    This makes downstream scoring + UI stable.
    """
    out = dict(p)
    for k in REQUIRED_KEYS:
        out.setdefault(k, None)
    return out


# -----------------------------
# Coercion helpers
# -----------------------------
def coerce_int(value: Any) -> Optional[int]:
    """
    Coerce values like '£450,000', '3 beds', '1,200,000' to int where possible.
    Uses first numeric group to avoid '12.5' -> 125 mistakes.
    """
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
        m = re.search(r"\d[\d,]*", s.replace(" ", ""))
        if not m:
            return None
        return int(m.group(0).replace(",", ""))
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
        cleaned = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
        return float(cleaned) if cleaned not in ("", ".", "-", "-.") else None
    except Exception:
        return None


# -----------------------------
# Normalizers
# -----------------------------
def normalize_source(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        s = str(value).strip()
        return s.lower() if s else None
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
    Filters to likely-valid image URLs.
    """
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]

    if not isinstance(value, list):
        return []

    cleaned: List[str] = []
    seen: set[str] = set()

    for item in value:
        if not item:
            continue
        u = str(item).strip()
        if not u:
            continue
        if not is_valid_image_url(u):
            continue
        if u not in seen:
            cleaned.append(u)
            seen.add(u)

    return cleaned


# -----------------------------
# Derived fields
# -----------------------------
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


# -----------------------------
# Optional: one-stop "contract normalize" helper (safe additive)
# -----------------------------
def normalize_property(p: Dict[str, Any]) -> Dict[str, Any]:
    """
    Additive helper: makes a property dict conform to the contract and normalizes
    types/fields in a way that matches backend/utils/validation.py.
    Does NOT delete unknown keys.
    """
    out = ensure_required_keys(p)

    out["source"] = normalize_source(out.get("source"))

    out["price"] = coerce_int(out.get("price"))

    # treat 0 beds/baths as unknown (None)
    beds = coerce_int(out.get("bedrooms"))
    baths = coerce_int(out.get("bathrooms"))
    out["bedrooms"] = None if beds == 0 else beds
    out["bathrooms"] = None if baths == 0 else baths

    out["latitude"] = coerce_float(out.get("latitude"))
    out["longitude"] = coerce_float(out.get("longitude"))

    out["property_type"] = normalize_property_type(out.get("property_type"))

    # images: normalize list, promote first to image_url if missing/invalid
    imgs = normalize_image_urls(out.get("image_urls"))
    out["image_urls"] = imgs

    img = out.get("image_url")
    img = str(img).strip() if isinstance(img, str) else None
    if img and not is_valid_image_url(img):
        img = None
    if not img and imgs:
        img = imgs[0]
    out["image_url"] = img

    # raw_url: keep only valid http/https
    raw = out.get("raw_url")
    raw = str(raw).strip() if isinstance(raw, str) else None
    out["raw_url"] = raw if (raw and is_valid_url(raw)) else None

    # computed marker (safe extra field)
    out["ai_ready"] = compute_ai_ready(out)

    return out
