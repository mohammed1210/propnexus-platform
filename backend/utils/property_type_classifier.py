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

NORMALISED_PROPERTY_TYPES: tuple[str, ...] = (
    "detached",
    "semi_detached",
    "terraced",
    "end_of_terrace",
    "flat",
    "apartment",
    "maisonette",
    "studio",
    "bungalow",
    "land",
    "commercial",
    "mixed_use",
    "unknown",
)

_LEGACY_TO_NORMALISED: dict[str, str] = {
    "Detached": "detached",
    "Semi-detached": "semi_detached",
    "Terraced": "terraced",
    "Flat/Apartment": "flat",
    "Studio": "studio",
    "Maisonette": "maisonette",
    "Bungalow": "bungalow",
    "Land": "land",
    "Commercial": "commercial",
    "HMO/Block": "mixed_use",
    "Other": "unknown",
}

_NORMALISED_SYNONYMS: dict[str, str] = {
    "semi detached": "semi_detached",
    "semi-detached": "semi_detached",
    "semi_detached": "semi_detached",
    "end terrace": "end_of_terrace",
    "end terraced": "end_of_terrace",
    "end of terrace": "end_of_terrace",
    "end-of-terrace": "end_of_terrace",
    "end_of_terrace": "end_of_terrace",
    "terrace": "terraced",
    "terraced": "terraced",
    "mid terrace": "terraced",
    "mid-terrace": "terraced",
    "detached": "detached",
    "flat": "flat",
    "apartment": "apartment",
    "maisonette": "maisonette",
    "studio": "studio",
    "bungalow": "bungalow",
    "land": "land",
    "plot": "land",
    "building plot": "land",
    "commercial": "commercial",
    "retail": "commercial",
    "shop": "commercial",
    "office": "commercial",
    "warehouse": "commercial",
    "mixed use": "mixed_use",
    "mixed-use": "mixed_use",
    "mixed_use": "mixed_use",
    "hmo": "mixed_use",
    "block of flats": "mixed_use",
}


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


def _to_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_to_text(v) for v in value]
        return " ".join(p for p in parts if p)
    if isinstance(value, tuple):
        parts = [_to_text(v) for v in value]
        return " ".join(p for p in parts if p)
    return ""


def _pick_from_dict(source: Dict[str, Any], keys: Iterable[str]) -> str:
    for key in keys:
        value = _to_text(source.get(key))
        if value:
            return value
    return ""


def _collect_property_text_fields(property_data: Dict[str, Any]) -> Dict[str, str]:
    data = property_data if isinstance(property_data, dict) else {}
    nested = data.get("data") if isinstance(data.get("data"), dict) else {}
    raw = nested.get("raw") if isinstance(nested.get("raw"), dict) else nested
    raw = raw if isinstance(raw, dict) else {}

    return {
        "title": _pick_from_dict(data, ["title", "name", "headline"])
        or _pick_from_dict(raw, ["title", "name", "headline"]),
        "description": _pick_from_dict(data, ["description", "details"])
        or _pick_from_dict(raw, ["description", "details"]),
        "summary": _pick_from_dict(data, ["summary", "short_description", "subtitle"])
        or _pick_from_dict(raw, ["summary", "short_description", "subtitle"]),
        "key_features": _pick_from_dict(
            data,
            ["key_features", "keyFeatures", "features", "bullet_points", "bullets"],
        )
        or _pick_from_dict(
            raw,
            ["key_features", "keyFeatures", "features", "bullet_points", "bullets"],
        ),
        "raw_property_type": _pick_from_dict(
            data,
            [
                "raw_property_type",
                "propertyType",
                "propertyTypeLabel",
                "property_type_label",
                "propertySubType",
                "property_sub_type",
                "typeLabel",
            ],
        )
        or _pick_from_dict(
            raw,
            [
                "raw_property_type",
                "propertyType",
                "propertyTypeLabel",
                "property_type_label",
                "propertySubType",
                "property_sub_type",
                "typeLabel",
            ],
        ),
        "property_type": _pick_from_dict(data, ["property_type", "propertyType", "type"])
        or _pick_from_dict(raw, ["property_type", "propertyType", "type"]),
    }


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

_SOURCE_WEIGHTS: dict[str, float] = {
    "title": 1.0,
    "description": 0.9,
    "summary": 0.86,
    "key_features": 0.92,
    "property_type": 0.74,
    "raw_property_type": 0.68,
}

_DETACHED_FALSE_POSITIVE_RE = re.compile(
    r"\bdetached\s+(?:garage|garages|outbuilding|outbuildings|annex|annexe|studio)\b",
    re.IGNORECASE,
)
_FLAT_FALSE_POSITIVE_RE = re.compile(
    r"\bflat\s+(?:roof|garden|walk|terrain)\b",
    re.IGNORECASE,
)
_SEMI_FALSE_POSITIVE_RE = re.compile(r"\bsemi[-\s]+(?:rural|open\s+plan)\b", re.IGNORECASE)

_TYPE_PATTERNS: list[tuple[str, list[tuple[str, re.Pattern[str]]]]] = [
    (
        "mixed_use",
        [
            ("mixed use", re.compile(r"\bmixed[-\s]+use\b", re.IGNORECASE)),
            ("HMO", re.compile(r"\bhmo\b|house\s+in\s+multiple\s+occupation", re.IGNORECASE)),
            ("block of flats", re.compile(r"\bblock\s+of\s+(?:flats|apartments)\b", re.IGNORECASE)),
        ],
    ),
    (
        "commercial",
        [
            (
                "commercial",
                re.compile(
                    r"\bcommercial\b|\bretail\b|\bshop\b|\boffice\b|\bwarehouse\b|\bindustrial\b|\bshowroom\b|\bcommercial\s+unit\b",
                    re.IGNORECASE,
                ),
            )
        ],
    ),
    (
        "land",
        [
            ("building plot", re.compile(r"\bbuilding\s+plot\b", re.IGNORECASE)),
            ("development site", re.compile(r"\bdevelopment\s+site\b", re.IGNORECASE)),
            ("land", re.compile(r"\bland\b|\bplot\b", re.IGNORECASE)),
        ],
    ),
    ("studio", [("studio", re.compile(r"\bstudio\b", re.IGNORECASE))]),
    ("maisonette", [("maisonette", re.compile(r"\bmaisonette\b", re.IGNORECASE))]),
    ("bungalow", [("bungalow", re.compile(r"\bbungalow\b", re.IGNORECASE))]),
    (
        "end_of_terrace",
        [
            (
                "end of terrace",
                re.compile(
                    r"\bend\s+(?:of\s+)?terrace(?:d)?\b|\bend[-\s]+terrace(?:d)?\b", re.IGNORECASE
                ),
            )
        ],
    ),
    (
        "semi_detached",
        [
            ("semi-detached", re.compile(r"\bsemi[-\s]*detached\b", re.IGNORECASE)),
            (
                "semi detached family home",
                re.compile(
                    r"\bsemi[-\s]*detached\s+(?:family\s+)?(?:home|house|property)\b", re.IGNORECASE
                ),
            ),
        ],
    ),
    (
        "terraced",
        [
            ("mid terrace", re.compile(r"\bmid[-\s]+terrace(?:d)?\b", re.IGNORECASE)),
            (
                "terraced",
                re.compile(r"\bterraced\b|\bterrace\s+house\b|\bterrace\s+home\b", re.IGNORECASE),
            ),
        ],
    ),
    (
        "detached",
        [
            (
                "detached house",
                re.compile(
                    r"\bdetached\s+(?:family\s+)?(?:house|home|property|residence)\b", re.IGNORECASE
                ),
            ),
            ("detached", re.compile(r"\bdetached\b", re.IGNORECASE)),
        ],
    ),
    ("flat", [("flat", re.compile(r"\bflat\b", re.IGNORECASE))]),
    (
        "apartment",
        [
            (
                "apartment",
                re.compile(r"\bapartment\b|\bpenthouse\b|\bduplex\b|\btriplex\b", re.IGNORECASE),
            )
        ],
    ),
]


def _normalise_raw_type(value: str) -> str:
    s = (value or "").strip()
    if not s:
        return ""
    exact = _NORMALISED_SYNONYMS.get(s.lower())
    if exact:
        return exact
    norm = _norm_text(s)
    return _NORMALISED_SYNONYMS.get(norm, "")


def _is_false_positive(property_type: str, text: str, matched_term: str) -> bool:
    if property_type == "detached" and _DETACHED_FALSE_POSITIVE_RE.search(text):
        # Strong house/home phrasing elsewhere can still override a garage mention.
        strong = re.search(
            r"\bdetached\s+(?:family\s+)?(?:house|home|property|residence)\b",
            text,
            re.IGNORECASE,
        )
        return not bool(strong)
    if property_type == "flat" and _FLAT_FALSE_POSITIVE_RE.search(text):
        return matched_term.lower() == "flat"
    if property_type == "semi_detached" and _SEMI_FALSE_POSITIVE_RE.search(text):
        return True
    return False


def _best_property_type_match(fields: Dict[str, str]) -> Dict[str, Any]:
    candidates: list[dict[str, Any]] = []

    for source, text in fields.items():
        if not text:
            continue
        source_weight = _SOURCE_WEIGHTS.get(source, 0.8)

        raw_guess = (
            _normalise_raw_type(text) if source in {"raw_property_type", "property_type"} else ""
        )
        if raw_guess:
            candidates.append(
                {
                    "type": raw_guess,
                    "confidence": min(0.86, source_weight),
                    "source": source,
                    "term": text.strip(),
                    "priority": 1,
                }
            )

        for priority, (ptype, patterns) in enumerate(_TYPE_PATTERNS, start=2):
            for term, pattern in patterns:
                if not pattern.search(text):
                    continue
                if _is_false_positive(ptype, text, term):
                    continue
                confidence = min(0.98, source_weight + max(0.0, (14 - priority) * 0.005))
                if source in {"raw_property_type", "property_type"}:
                    confidence = min(confidence, 0.84)
                candidates.append(
                    {
                        "type": ptype,
                        "confidence": confidence,
                        "source": source,
                        "term": term,
                        "priority": priority,
                    }
                )

    if not candidates:
        return {
            "type": "unknown",
            "confidence": 0.0,
            "source": "unknown",
            "terms": [],
        }

    candidates.sort(key=lambda c: (float(c["confidence"]), -int(c["priority"])), reverse=True)
    best = candidates[0]
    best_type = str(best["type"])
    terms: list[str] = []
    for item in candidates:
        if item.get("type") != best_type:
            continue
        term = str(item.get("term") or "").strip()
        if term and term not in terms:
            terms.append(term)

    return {
        "type": best_type,
        "confidence": round(float(best["confidence"]), 2),
        "source": str(best["source"]),
        "terms": terms[:6],
    }


def classify_property_type_enrichment(property_data: Dict[str, Any]) -> Dict[str, Any]:
    """Return additive property-type enrichment fields for a scraped property row."""

    fields = _collect_property_text_fields(property_data if isinstance(property_data, dict) else {})
    raw_property_type = fields.get("raw_property_type") or fields.get("property_type") or ""
    best = _best_property_type_match(fields)
    normalised = str(best.get("type") or "unknown")

    raw_norm = _normalise_raw_type(raw_property_type)
    property_type_mismatch = bool(raw_norm and normalised != "unknown" and raw_norm != normalised)

    return {
        "raw_property_type": raw_property_type or "",
        "normalised_property_type": normalised,
        "property_type_confidence": float(best.get("confidence") or 0.0),
        "property_type_source": str(best.get("source") or "unknown"),
        "property_type_mismatch": property_type_mismatch,
        "matched_type_terms": list(best.get("terms") or []),
    }


def preferred_property_type_key(property_data: Dict[str, Any]) -> str:
    """Resolve filter key using the frontend/API fallback order."""

    for key in ("normalised_property_type", "property_type", "raw_property_type", "type"):
        value = property_data.get(key) if isinstance(property_data, dict) else None
        if not isinstance(value, str) or not value.strip():
            continue
        direct = value.strip()
        if direct in NORMALISED_PROPERTY_TYPES:
            return direct
        norm = _normalise_raw_type(direct)
        if norm:
            return norm
        legacy = normalize_property_type_value(direct)
        if legacy:
            return _LEGACY_TO_NORMALISED.get(legacy, "unknown")
    return "unknown"


def _classify_property_type_legacy(
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


def classify_property_type(
    title: str | Dict[str, Any] | None,
    description: str | None = None,
    raw_type: str | None = None,
    extra: Dict[str, Any] | None = None,
) -> Tuple[str, str] | Dict[str, Any]:
    """Classify property type.

    Backwards compatible modes:
    - classify_property_type(title, description, raw_type, extra) -> (legacy_label, raw_type)
    - classify_property_type(property_data) -> enrichment dict with normalised fields
    """

    if isinstance(title, dict) and description is None and raw_type is None:
        return classify_property_type_enrichment(title)

    return _classify_property_type_legacy(
        title if isinstance(title, str) else None,
        description,
        raw_type,
        extra=extra,
    )
