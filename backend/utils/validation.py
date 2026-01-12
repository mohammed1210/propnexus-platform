# backend/utils/validation.py
"""Data validation utilities for scraped properties."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse


# -----------------------------
# URL + Image URL validation
# -----------------------------
def is_valid_url(url: Optional[str]) -> bool:
    """Check if a string is a valid absolute URL (http/https only)."""
    if not url or not isinstance(url, str):
        return False

    try:
        result = urlparse(url.strip())
        if not (result.scheme and result.netloc):
            return False
        return result.scheme in {"http", "https"}
    except Exception:
        return False


def is_valid_image_url(url: Optional[str]) -> bool:
    """Check if a URL is likely a valid image URL."""
    if not url or not isinstance(url, str):
        return False

    url = url.strip()

    # Data URLs are valid for images
    if url.startswith("data:image/"):
        return True

    if not is_valid_url(url):
        return False

    url_lower = url.lower()

    # Check for common image extensions
    image_extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg")
    if url_lower.endswith(image_extensions):
        return True

    # Check for common image URL patterns (e.g., /images/, /photos/, etc.)
    image_patterns = (
        "/image",
        "/photo",
        "/picture",
        "/media",
        "/upload",
        "cdn",
        "cloudfront",
    )
    return any(pattern in url_lower for pattern in image_patterns)


# -----------------------------
# Coercion + normalization helpers (internal)
# -----------------------------
def _as_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    try:
        s = str(v).strip()
        return s or None
    except Exception:
        return None


def _coerce_int(v: Any) -> Optional[int]:
    """Coerce values like '£450,000' or '3 beds' to int where possible."""
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    try:
        s = str(v).strip()
        if not s:
            return None
        # extract first number group
        m = re.search(r"\d[\d,]*", s.replace(" ", ""))
        if not m:
            return None
        return int(m.group(0).replace(",", ""))
    except Exception:
        return None


def _coerce_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        s = str(v).strip()
        if not s:
            return None
        # allow minus and dot
        cleaned = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
        if cleaned in ("", ".", "-", "-."):
            return None
        return float(cleaned)
    except Exception:
        return None


def _normalize_source(v: Any) -> Optional[str]:
    s = _as_str(v)
    return s.lower() if s else None


def _normalize_property_type(text: Any) -> Optional[str]:
    """Normalize property type text to standard values."""
    s = _as_str(text)
    if not s:
        return None
    lower = s.lower()

    # order matters - studio before flat
    if "studio" in lower:
        return "studio"
    if "flat" in lower or "apartment" in lower:
        return "flat"
    if "semi-detached" in lower or "semi detached" in lower:
        return "semi-detached"
    if "detached" in lower and "semi" not in lower:
        return "detached"
    if "terraced" in lower:
        return "terraced"
    if "bungalow" in lower:
        return "bungalow"
    if "maisonette" in lower:
        return "maisonette"
    if "cottage" in lower:
        return "cottage"
    if "house" in lower:
        return "house"

    return None


def _normalize_image_urls(v: Any) -> List[str]:
    """Ensure image_urls is a list[str] with unique items, preserving order."""
    if v is None:
        return []
    if isinstance(v, str):
        v = [v]
    if not isinstance(v, list):
        return []

    out: List[str] = []
    seen: set[str] = set()

    for item in v:
        u = _as_str(item)
        if not u:
            continue
        if not is_valid_image_url(u):
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)

    return out


def _ai_ready(data: Dict[str, Any]) -> bool:
    """Conservative AI readiness check (safe extra field)."""
    if not _as_str(data.get("source")):
        return False
    if not _as_str(data.get("external_id")):
        return False
    if not _as_str(data.get("title")):
        return False
    if not (_as_str(data.get("location")) or _as_str(data.get("address"))):
        return False
    if data.get("price") is None:
        return False
    if data.get("bedrooms") is None:
        return False
    if data.get("latitude") is None or data.get("longitude") is None:
        return False
    return True


# -----------------------------
# Public validation API
# -----------------------------
def validate_property_data(data: Dict[str, Any]) -> Dict[str, List[str]]:
    """Validate property data and return validation issues."""
    issues: Dict[str, List[str]] = {}

    # Validate external_id
    external_id = data.get("external_id")
    if not external_id or not str(external_id).strip():
        issues.setdefault("external_id", []).append("Missing or empty external_id")

    # Validate title
    title = data.get("title")
    if (
        not title
        or not str(title).strip()
        or str(title).strip().lower() in ["untitled", "property", "listing"]
    ):
        issues.setdefault("title", []).append("Missing or generic title")

    # Validate price
    price = data.get("price")
    if price is not None:
        try:
            price_int = int(price)
            if price_int <= 0:
                issues.setdefault("price", []).append(f"Invalid price: {price} (must be > 0)")
        except (ValueError, TypeError):
            issues.setdefault("price", []).append(f"Invalid price format: {price}")

    # Validate image_url
    image_url = data.get("image_url")
    if image_url and not is_valid_image_url(str(image_url)):
        issues.setdefault("image_url", []).append(f"Invalid image URL: {image_url}")

    # Validate image_urls array
    image_urls = data.get("image_urls")
    if image_urls:
        if not isinstance(image_urls, list):
            issues.setdefault("image_urls", []).append("image_urls must be a list")
        else:
            invalid_urls = [url for url in image_urls if not is_valid_image_url(str(url))]
            if invalid_urls:
                issues.setdefault("image_urls", []).append(
                    f"Invalid image URLs: {invalid_urls[:3]}"  # Show first 3
                )

    # Validate coordinates
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if latitude is not None:
        try:
            lat_float = float(latitude)
            if not (-90 <= lat_float <= 90):
                issues.setdefault("latitude", []).append(f"Latitude out of range: {latitude}")
        except (ValueError, TypeError):
            issues.setdefault("latitude", []).append(f"Invalid latitude: {latitude}")

    if longitude is not None:
        try:
            lng_float = float(longitude)
            if not (-180 <= lng_float <= 180):
                issues.setdefault("longitude", []).append(f"Longitude out of range: {longitude}")
        except (ValueError, TypeError):
            issues.setdefault("longitude", []).append(f"Invalid longitude: {longitude}")

    # Validate bedrooms/bathrooms (treat 0 as "missing" as per your old logic)
    for field in ["bedrooms", "bathrooms"]:
        value = data.get(field)
        if value is not None and value != 0:
            try:
                int_val = int(value)
                if int_val < 0:
                    issues.setdefault(field, []).append(f"{field} cannot be negative: {value}")
            except (ValueError, TypeError):
                issues.setdefault(field, []).append(f"Invalid {field} format: {value}")

    # Validate source
    source = data.get("source")
    if not source or not str(source).strip():
        issues.setdefault("source", []).append("Missing source")

    # Validate raw_url if present (optional but useful)
    raw_url = data.get("raw_url")
    if raw_url and not is_valid_url(str(raw_url)):
        issues.setdefault("raw_url", []).append(f"Invalid raw_url: {raw_url}")

    return issues


def should_insert_property(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Determine if a property should be inserted into the database."""
    external_id = data.get("external_id")
    if not external_id or not str(external_id).strip():
        return False, "Missing external_id"

    title = data.get("title")
    if not title or not str(title).strip():
        return False, "Missing title"

    title_lower = str(title).strip().lower()
    if title_lower in ["untitled", "property", "listing"]:
        return False, f"Generic title: {title}"

    # Must have either price or location
    price = data.get("price")
    location = data.get("location") or data.get("address")
    if not price and not location:
        return False, "Missing both price and location"

    # Validate price if present
    if price is not None:
        try:
            price_int = int(price)
            if price_int <= 0:
                return False, f"Invalid price: {price}"
        except (ValueError, TypeError):
            return False, f"Invalid price format: {price}"

    # Must have source
    source = data.get("source")
    if not source or not str(source).strip():
        return False, "Missing source"

    return True, None


def clean_property_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and normalize property data."""
    cleaned = data.copy()

    # Ensure common keys exist (non-breaking; keeps extra keys untouched)
    for k in [
        "external_id",
        "title",
        "location",
        "address",
        "description",
        "source",
        "price",
        "bedrooms",
        "bathrooms",
        "property_type",
        "image_url",
        "image_urls",
        "latitude",
        "longitude",
        "raw_url",
    ]:
        cleaned.setdefault(k, None)

    # Normalize string fields
    for field in ["title", "location", "address", "description", "source", "raw_url"]:
        if field in cleaned and cleaned[field] is not None:
            cleaned[field] = str(cleaned[field]).strip() or None

    # Normalize source to lowercase
    cleaned["source"] = _normalize_source(cleaned.get("source"))

    # Normalize numeric fields (treat 0 beds/baths as missing)
    cleaned["price"] = _coerce_int(cleaned.get("price"))

    for field in ["bedrooms", "bathrooms"]:
        v = _coerce_int(cleaned.get(field))
        cleaned[field] = None if v == 0 else v

    # Normalize coordinate fields
    cleaned["latitude"] = _coerce_float(cleaned.get("latitude"))
    cleaned["longitude"] = _coerce_float(cleaned.get("longitude"))

    # Normalize property type (safe)
    cleaned["property_type"] = _normalize_property_type(cleaned.get("property_type"))

    # Normalize + de-dupe images
    imgs = _normalize_image_urls(cleaned.get("image_urls"))
    cleaned["image_urls"] = imgs

    image_url = _as_str(cleaned.get("image_url"))
    if image_url and not is_valid_image_url(image_url):
        image_url = None
    if not image_url and imgs:
        image_url = imgs[0]
    cleaned["image_url"] = image_url

    # Validate raw_url if present; otherwise set None
    raw_url = _as_str(cleaned.get("raw_url"))
    cleaned["raw_url"] = raw_url if (raw_url and is_valid_url(raw_url)) else None

    # Optional computed field (routes now strip before DB upsert)
    cleaned["ai_ready"] = _ai_ready(cleaned)

    return cleaned
