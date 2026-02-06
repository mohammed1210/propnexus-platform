from __future__ import annotations

import hashlib
import re
from typing import Any, Dict

_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)

# Outward-only district (e.g., SW11, EC1V, W1K, E8, EH7, G72, M1).
# We deliberately avoid matching inside flat numbers like "1F2" / "3F2".
_OUTWARD_RE = re.compile(r"(?<![A-Z0-9])[A-Z]{1,2}\d{1,2}[A-Z]?\b", re.I)


def extract_postcode(text: Any) -> str | None:
    if not isinstance(text, str):
        return None

    # 1) Prefer a full postcode when present.
    m = _POSTCODE_RE.search(text)
    if m:
        return re.sub(r"\s+", "", m.group(0).upper())

    # 2) Fallback to outward-only district.
    # Use finditer + context scoring so we prefer tokens that look like real postcodes
    # (surrounded by whitespace/punctuation) and avoid flat-number substrings.
    best: str | None = None
    best_score = -1
    s = text

    for mm in _OUTWARD_RE.finditer(s):
        candidate = mm.group(0)
        if not candidate:
            continue

        start = mm.start()
        end = mm.end()

        prev = s[start - 1] if start > 0 else ""
        nxt = s[end] if end < len(s) else ""

        # Hard guard: don't allow a match where the preceding character is a digit.
        # This prevents "1F2" -> "F2" and similar patterns.
        if prev.isdigit():
            continue

        # Soft guard: if surrounded by letters/digits, it's likely part of another token.
        if prev and prev.isalnum():
            continue
        if nxt and nxt.isalnum():
            continue

        score = 0
        if start == 0:
            score += 1
        if prev in (" ", "\t", "\n", ",", ";", ":", "(", "[", "{"):
            score += 2
        if (not nxt) or (
            nxt in (" ", "\t", "\n", ".", ",", ";", ":", ")", "]", "}", "/", "\\", "-")
        ):
            score += 2

        # Prefer longer outward codes (EC1V over E8) when equally plausible.
        score += len(candidate)

        if score > best_score:
            best_score = score
            best = candidate

    if not best:
        return None

    return re.sub(r"\s+", "", best.upper())


def _coerce_int(v: Any) -> int | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        digits = "".join(ch for ch in v if ch.isdigit())
        try:
            return int(digits) if digits else None
        except Exception:
            return None
    return None


def _normalize_text(v: Any) -> str:
    if not isinstance(v, str):
        return ""
    s = v.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _external_id_from_url(source: str, url: str) -> str | None:
    if not isinstance(url, str) or not url.strip():
        return None
    u = url.strip()
    src = (source or "").lower().strip()

    if src == "rightmove":
        m = re.search(r"/properties/(\d+)", u)
        if m:
            return m.group(1)
    if src == "zoopla":
        m = re.search(r"/details/(\d+)", u)
        if m:
            return m.group(1)
        m = re.search(r"listingId=(\d+)", u, re.I)
        if m:
            return m.group(1)
    if src == "onthemarket":
        m = re.search(r"/details/(\d+)", u)
        if m:
            return f"ot-{m.group(1)}"

    # Generic numeric id fallback.
    nums = re.findall(r"\d{6,}", u)
    return nums[0] if nums else None


def canonical_listing_hash(
    *,
    source: str,
    address: Any,
    location: Any,
    postcode: Any,
    price: Any,
    bedrooms: Any,
) -> str:
    src = (source or "unknown").lower().strip()
    addr_norm = _normalize_text(address) or _normalize_text(location)
    pc = extract_postcode(postcode) or extract_postcode(address) or extract_postcode(location)
    pr = _coerce_int(price)
    beds = _coerce_int(bedrooms)

    material = "|".join(
        [
            src,
            pc or "",
            addr_norm,
            str(pr or ""),
            str(beds or ""),
        ]
    )

    return hashlib.sha1(material.encode("utf-8")).hexdigest()[:16]


def ensure_external_id(row: Dict[str, Any]) -> str | None:
    """Ensure a stable external_id for upsert/dedupe.

    Priority:
    1) existing row[external_id]
    2) parse from URL (source-specific)
    3) stable hash of address/postcode/price/bedrooms

    Returns the external_id (does not mutate input).
    """

    ext = row.get("external_id")
    if isinstance(ext, str) and ext.strip():
        return ext.strip()

    source = str(row.get("source") or "").strip().lower()
    url = row.get("url") or row.get("listing_url") or row.get("raw_url")
    if isinstance(url, str) and url.strip():
        parsed = _external_id_from_url(source, url)
        if parsed:
            return parsed

    return canonical_listing_hash(
        source=source,
        address=row.get("address"),
        location=row.get("location"),
        postcode=row.get("postcode"),
        price=row.get("price"),
        bedrooms=row.get("bedrooms"),
    )


def strip_empty_for_upsert(row: Dict[str, Any]) -> Dict[str, Any]:
    """Drop empty values so incomplete refreshes don't clobber existing data."""

    keep = {
        "source",
        "external_id",
        "url",
        "last_seen_at",
        "raw_url",
    }

    out: Dict[str, Any] = {}
    for k, v in (row or {}).items():
        if k in keep:
            out[k] = v
            continue

        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        if isinstance(v, (list, dict)) and not v:
            # Avoid clobbering good arrays/JSON with empties.
            continue
        if k in ("price", "bedrooms", "bathrooms") and v in (0, 0.0, "0"):
            continue
        if k in ("latitude", "longitude") and v in (0, 0.0, "0"):
            continue

        out[k] = v

    return out
