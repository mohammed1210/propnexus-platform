from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Tuple

CANONICAL_PROPERTY_TYPES: tuple[str, ...] = (
    "Detached",
    "Semi-detached",
    "Terraced",
    "Flat/Apartment",
    "Studio",
    "Maisonette",
    "Bungalow",
    "Land",
    "Commercial",
    "HMO/Block",
    "Other",
)


_WORD_RE = re.compile(r"[^a-z0-9]+", re.IGNORECASE)


def _norm_text(value: str) -> str:
    s = (value or "").strip().lower()
    if not s:
        return ""
    s = s.replace("&", " and ")
    s = _WORD_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _first_non_empty(values: Iterable[Any]) -> str:
    for v in values:
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _pick_extra_raw_type(extra: Dict[str, Any] | None) -> str:
    if not isinstance(extra, dict):
        return ""

    candidates: list[Any] = []

    # Common source keys
    for key in (
        "propertyType",
        "property_type",
        "propertyTypeLabel",
        "property_type_label",
        "propertySubType",
        "property_sub_type",
        "type",
        "typeLabel",
    ):
        candidates.append(extra.get(key))

    # Some payloads wrap fields under `raw`
    raw = extra.get("raw")
    if isinstance(raw, dict):
        for key in (
            "propertyType",
            "property_type",
            "propertyTypeLabel",
            "property_type_label",
            "propertySubType",
            "property_sub_type",
            "type",
            "typeLabel",
        ):
            candidates.append(raw.get(key))

    return _first_non_empty(candidates)


def normalize_property_type_value(value: str | None) -> str | None:
    """Normalize a *label* into a canonical property type.

    This is intended for query params / UI values. Unknown values return None.
    """

    raw = (value or "").strip()
    if not raw:
        return None

    # Exact canonical (case-insensitive)
    for c in CANONICAL_PROPERTY_TYPES:
        if raw.lower() == c.lower():
            return c

    s = _norm_text(raw)

    # Synonym normalization (exact / strong matches)
    synonym_map: dict[str, str] = {
        "semi detached": "Semi-detached",
        "semi detatched": "Semi-detached",
        "semi": "Semi-detached",
        "detached": "Detached",
        "terrace": "Terraced",
        "terraced": "Terraced",
        "mid terrace": "Terraced",
        "end terrace": "Terraced",
        "apartment": "Flat/Apartment",
        "flat": "Flat/Apartment",
        "penthouse": "Flat/Apartment",
        "duplex": "Flat/Apartment",
        "triplex": "Flat/Apartment",
        "studio": "Studio",
        "maisonette": "Maisonette",
        "bungalow": "Bungalow",
        "building plot": "Land",
        "plot": "Land",
        "land": "Land",
        "development site": "Land",
        "commercial": "Commercial",
        "retail": "Commercial",
        "shop": "Commercial",
        "office": "Commercial",
        "warehouse": "Commercial",
        "industrial": "Commercial",
        "hmo": "HMO/Block",
        "block of flats": "HMO/Block",
        "block of apartments": "HMO/Block",
        "portfolio": "HMO/Block",
    }

    if s in synonym_map:
        return synonym_map[s]

    # Heuristic fallback: treat as classifier input, but avoid mapping unknowns to "Other".
    guess, _raw = classify_property_type(title=None, description=None, raw_type=raw, extra=None)
    return guess if guess != "Other" else None


def _has(pattern: re.Pattern[str], text: str) -> bool:
    return bool(text and pattern.search(text))


# Precompiled patterns with word boundaries (avoid false positives like unit in community)
_RE_COMMERCIAL = re.compile(
    r"\bcommercial\b|\bretail\b|\bshop\b|\boffice\b|\bwarehouse\b|\bindustrial\b|\bshowroom\b|\bunit\b",
    re.IGNORECASE,
)
_RE_LAND = re.compile(
    r"\bland\b|\bplot\b|\bbuilding\s+plot\b|\bdevelopment\s+site\b",
    re.IGNORECASE,
)
_RE_HMO_BLOCK = re.compile(
    r"(^|\b)hmo(\b|$)|house\s+in\s+multiple\s+occupation|block\s+of\s+flats|block\s+of\s+apartments|\bportfolio\b",
    re.IGNORECASE,
)
_RE_STUDIO = re.compile(r"\bstudio\b", re.IGNORECASE)
_RE_MAISONETTE = re.compile(r"\bmaisonette\b", re.IGNORECASE)
_RE_BUNGALOW = re.compile(r"\bbungalow\b", re.IGNORECASE)
_RE_FLAT = re.compile(
    r"\bflat\b|\bapartment\b|\bpenthouse\b|\bduplex\b|\btriplex\b",
    re.IGNORECASE,
)
_RE_SEMI_DETACHED_STRONG = re.compile(r"\bsemi\s*[-]?\s*detached\b", re.IGNORECASE)
_RE_SEMI_LOOSE = re.compile(r"\bsemi\b", re.IGNORECASE)
_RE_DETACHED = re.compile(r"\bdetached\b", re.IGNORECASE)
_RE_TERRACED = re.compile(
    r"\bterraced\b|\bterrace\b|\bmid\s+terrace\b|\bend\s+terrace\b",
    re.IGNORECASE,
)
_RE_HOUSE = re.compile(r"\bhouse\b", re.IGNORECASE)


def classify_property_type(
    title: str | None,
    description: str | None,
    raw_type: str | None,
    extra: Dict[str, Any] | None = None,
) -> Tuple[str, str]:
    """Deterministically classify a property type.

    Returns (normalized_type, raw_type_best).

    - normalized_type is one of CANONICAL_PROPERTY_TYPES
    - raw_type_best is a best-effort label from inputs/extra; may be ""
    """

    raw_best = _first_non_empty([raw_type, _pick_extra_raw_type(extra)])

    combined = " ".join(
        s for s in [raw_best, title or "", description or ""] if isinstance(s, str) and s.strip()
    )
    text = _norm_text(combined)

    # Priority-ordered heuristics (stop at first strong match)

    # 1) Commercial
    if _has(_RE_COMMERCIAL, text):
        # Avoid the classic false positive: "community" contains "unit".
        # Word boundaries already handle it, but keep as belt-and-suspenders.
        if not re.search(r"\bcommunity\b", text, re.IGNORECASE):
            return "Commercial", raw_best

    # 2) Land
    if _has(_RE_LAND, text):
        return "Land", raw_best

    # 3) HMO/Block
    if _has(_RE_HMO_BLOCK, text):
        return "HMO/Block", raw_best

    # 4) Studio
    if _has(_RE_STUDIO, text):
        return "Studio", raw_best

    # 5) Maisonette
    if _has(_RE_MAISONETTE, text):
        return "Maisonette", raw_best

    # 6) Bungalow
    if _has(_RE_BUNGALOW, text):
        return "Bungalow", raw_best

    # 7) Flat/Apartment
    if _has(_RE_FLAT, text):
        return "Flat/Apartment", raw_best

    # 8) Detached / Semi / Terraced
    # Small scoring so semi-detached beats detached when both appear.
    if _has(_RE_SEMI_DETACHED_STRONG, text):
        return "Semi-detached", raw_best

    if _has(_RE_TERRACED, text):
        return "Terraced", raw_best

    if _has(_RE_DETACHED, text) and _has(_RE_SEMI_LOOSE, text):
        return "Semi-detached", raw_best

    # Loose 'semi' is only trusted when it appears with a house-ish context.
    if _has(_RE_SEMI_LOOSE, text) and (_has(_RE_HOUSE, text) or _has(_RE_DETACHED, text)):
        return "Semi-detached", raw_best

    if _has(_RE_DETACHED, text):
        return "Detached", raw_best

    return "Other", raw_best
