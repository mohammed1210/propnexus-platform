from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

SOURCE_ALIASES = {
    "rightmove": "rightmove",
    "rm": "rightmove",
    "zoopla": "zoopla",
    "onthemarket": "onthemarket",
    "otm": "onthemarket",
    "spare room": "spareroom",
    "spare-room": "spareroom",
    "spareroom": "spareroom",
}

FULL_POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)[\s-]*(\d[A-Z]{2})\b", re.I)
OUTWARD_POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\b", re.I)


@dataclass(frozen=True)
class PostcodeMatch:
    value: str | None
    quality: str
    source: str


def normalize_source_value(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    lowered = re.sub(r"\s+", " ", raw.lower())
    return SOURCE_ALIASES.get(lowered, lowered)


def is_full_postcode(value: Any) -> bool:
    return bool(FULL_POSTCODE_RE.search(str(value or "")))


def normalize_postcode(value: Any) -> PostcodeMatch:
    text = str(value or "").upper().replace("_", " ")
    text = re.sub(r"[^A-Z0-9\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return PostcodeMatch(None, "missing", "missing")

    full = FULL_POSTCODE_RE.search(text)
    if full:
        return PostcodeMatch(f"{full.group(1).upper()} {full.group(2).upper()}", "full", "text")

    outward = OUTWARD_POSTCODE_RE.search(text)
    if outward:
        return PostcodeMatch(outward.group(1).upper(), "outward", "text")

    return PostcodeMatch(None, "missing", "missing")


def _flatten_raw(value: Any) -> str:
    if value in (None, "", [], {}):
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=True, sort_keys=True)
    except Exception:
        return str(value)


def extract_best_postcode(row: dict[str, Any]) -> PostcodeMatch:
    fields = [
        ("explicit", row.get("postcode") or row.get("postcode_full") or row.get("postal_code")),
        ("location", row.get("location") or row.get("address")),
        ("title", row.get("title")),
        ("description", row.get("description")),
    ]

    data = row.get("data")
    raw = data.get("raw") if isinstance(data, dict) else None
    if raw in (None, "", [], {}):
        raw = row.get("raw")
    fields.append(("raw", _flatten_raw(raw)))

    best_outward: PostcodeMatch | None = None
    for source, value in fields:
        match = normalize_postcode(value)
        if match.quality == "full":
            return PostcodeMatch(match.value, "full", source)
        if match.quality == "outward" and best_outward is None:
            best_outward = PostcodeMatch(match.value, "outward", source)

    return best_outward or PostcodeMatch(None, "missing", "missing")


def clean_image_urls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        url = item.strip()
        if not url:
            continue
        if url.startswith("//"):
            url = f"https:{url}"
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def should_replace_postcode(
    existing: Any, candidate: PostcodeMatch, *, force: bool = False
) -> bool:
    if not candidate.value:
        return False
    current = normalize_postcode(existing)
    if force:
        return current.value != candidate.value
    if current.quality == "full":
        return False
    if current.quality == "outward" and candidate.quality != "full":
        return False
    return current.value != candidate.value


def build_quality_patch(row: dict[str, Any], *, force: bool = False) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    data = row.get("data") if isinstance(row.get("data"), dict) else {}
    new_data = dict(data)

    normalized_source = normalize_source_value(row.get("source"))
    if normalized_source and (force or normalized_source != row.get("source")):
        patch["source"] = normalized_source

    postcode = extract_best_postcode(row)
    if should_replace_postcode(row.get("postcode"), postcode, force=force):
        patch["postcode"] = postcode.value
    if postcode.quality != "missing":
        new_data["postcode_source"] = postcode.source
        new_data["postcode_quality"] = postcode.quality

    image_urls = clean_image_urls(row.get("image_urls"))
    if image_urls and (force or image_urls != row.get("image_urls")):
        patch["image_urls"] = image_urls
    if image_urls and (force or not row.get("imageurl")):
        patch["imageurl"] = image_urls[0]

    for key in (
        "source_url",
        "original_listing_url",
        "listing_url",
        "property_url",
        "external_url",
        "url",
    ):
        value = row.get(key) or data.get(key)
        if isinstance(value, str) and value.strip():
            if not row.get("url"):
                patch["url"] = value.strip()
            if not row.get("source_url"):
                patch["source_url"] = value.strip()
            break

    if new_data != data:
        patch["data"] = new_data

    return patch
