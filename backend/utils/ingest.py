#!/usr/bin/env python3
"""
ingest.py — normalize scraped property records and upsert into Supabase.

✅ Handles Rightmove + Zoopla external_id extraction (fixes Zoopla regression)
✅ Normalizes common fields (price/bed/bath/lat/lng/yield/roi)
✅ Safe upsert with fallback if your DB does NOT have external_id/source/url columns
✅ Batch upsert with basic retry + helpful logging

USAGE
-----
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="xxxxx"

python ingest.py --input scraper/output.json --source zoopla
python ingest.py --input scraper/output.ndjson --source rightmove

python ingest.py --input scraper/output.json --source zoopla --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from dotenv import load_dotenv

from backend.utils.deal_signals import extract_deal_signals
from backend.utils.property_quality import (
    clean_image_urls,
    extract_best_postcode,
    normalize_source_value,
    should_replace_postcode,
)
from backend.utils.property_type_classifier import classify_property_type
from backend.utils.supabase_client import get_supabase
from supabase import Client

load_dotenv()

DEFAULT_TABLE = "properties"


# ----------------------------
# Logging helpers
# ----------------------------
def log(msg: str) -> None:
    print(f"[ingest] {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"[ingest][WARN] {msg}", flush=True)


def err(msg: str) -> None:
    print(f"[ingest][ERROR] {msg}", file=sys.stderr, flush=True)


# ----------------------------
# Supabase client
# ----------------------------
def get_supabase_client() -> Client:
    sb = get_supabase(required=True)
    if sb is None:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )
    return sb  # type: ignore[return-value]


# ----------------------------
# Input loading
# ----------------------------
def load_records(path: str) -> List[Dict[str, Any]]:
    """
    Accepts either:
      - JSON list file: [ {...}, {...} ]
      - NDJSON file: one JSON object per line
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()

    if not raw:
        return []

    # Try JSON list first
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [r for r in parsed if isinstance(r, dict)]
        if isinstance(parsed, dict):
            return [parsed]
    except Exception:
        pass

    # Fallback to NDJSON
    records: List[Dict[str, Any]] = []
    for i, line in enumerate(raw.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                records.append(obj)
        except Exception as e:
            warn(f"Skipping invalid JSON on line {i}: {e}")
    return records


# ----------------------------
# Normalization helpers
# ----------------------------
_PRICE_RE = re.compile(r"[\d,]+")


def to_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return int(v)
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        m = _PRICE_RE.findall(s)
        if not m:
            return None
        digits = "".join(m).replace(",", "")
        try:
            return int(digits)
        except Exception:
            return None
    return None


def to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace("%", "")
        if not s:
            return None
        s = s.replace(",", "")
        try:
            return float(s)
        except Exception:
            return None
    return None


def clean_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    s = str(v).strip()
    return s if s else None


def pick_first(d: Dict[str, Any], keys: Iterable[str]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, "", [], {}):
            return d[k]
    return None


# ----------------------------
# Media + postcode helpers
# ----------------------------
_MEDIA_SLOT_RE = re.compile(r"/(image|floor\-plan)\-(\d+)\-", re.IGNORECASE)
_FULL_POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", re.I)
_OUTWARD_POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\b", re.I)
_OUTWARD_POSTCODE_FULL_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?$", re.I)


def normalize_media_urls(urls: list[str] | None) -> dict[str, Any]:
    """Normalize media URL lists for frontend performance.

    - Dedupe logical photo slots: /image-0-*.webp and /image-0-*.jpg count as same slot.
    - Split photos vs floorplans.
    - Choose a stable hero image (never a floorplan).
    """

    if not urls:
        return {"imageurl": None, "image_urls": [], "floorplan_urls": []}

    photos: list[str] = []
    floorplans: list[str] = []

    seen_photo_slots: set[str] = set()
    seen_floor_slots: set[str] = set()

    for u in urls:
        if not isinstance(u, str):
            continue
        s = u.strip()
        if not s:
            continue

        is_photo = "/image-" in s
        is_floor = "/floor-plan-" in s
        if not (is_photo or is_floor):
            continue

        m = _MEDIA_SLOT_RE.search(s)
        slot = None
        if m:
            slot = f"{m.group(1).lower()}-{m.group(2)}"

        if is_photo:
            key = slot or s
            if key in seen_photo_slots:
                continue
            seen_photo_slots.add(key)
            photos.append(s)
        elif is_floor:
            key = slot or s
            if key in seen_floor_slots:
                continue
            seen_floor_slots.add(key)
            floorplans.append(s)

    hero = None
    if photos:
        hero = next(
            (u for u in photos if "/image-0-" in u and u.lower().endswith(".webp")),
            None,
        )
        if not hero:
            hero = next(
                (u for u in photos if "/image-0-" in u and u.lower().endswith(".jpg")),
                None,
            )
        hero = hero or photos[0]

    return {"imageurl": hero, "image_urls": photos, "floorplan_urls": floorplans}


def extract_postcode_from_text(text: str | None) -> str | None:
    """Extract a UK postcode (full or outward) from free text.

    - Full postcode example: "SW1A 1AA" (normalizes spacing)
    - Outward example: "N22", "SW3", "E14", "WC2"
    """

    if not text or not isinstance(text, str):
        return None
    t = text.strip()
    if not t:
        return None

    m = _FULL_POSTCODE_RE.search(t)
    if m:
        compact = re.sub(r"\s+", "", m.group(1)).upper()
        if len(compact) >= 5:
            return f"{compact[:-3]} {compact[-3:]}"
        return compact

    m2 = _OUTWARD_POSTCODE_RE.search(t)
    if m2:
        outward = re.sub(r"\s+", "", m2.group(1)).upper()
        return outward or None
    return None


def postcode_band(postcode: str | None) -> str | None:
    """Derive an outward (district) postcode from a postcode string.

    Examples:
      - "SW1A 1AA" -> "SW1A"
      - "N22" -> "N22"
    """

    if not postcode or not isinstance(postcode, str):
        return None
    raw = postcode.strip()
    if not raw:
        return None

    norm = extract_postcode_from_text(raw) or re.sub(r"\s+", " ", raw).strip().upper()
    if not norm:
        return None

    outward = (norm.split(" ", 1)[0] or "").strip().upper()
    if not outward:
        return None
    if not _OUTWARD_POSTCODE_FULL_RE.fullmatch(outward):
        return None
    return outward


# ----------------------------
# external_id extraction (fix)
# ----------------------------
RIGHTMOVE_ID_RE = re.compile(r"/properties/(\d+)")
ZOOPLA_ID_RE_1 = re.compile(r"/details/(\d+)")
ZOOPLA_ID_RE_2 = re.compile(r"listingId=(\d+)", re.IGNORECASE)


def extract_external_id(
    source: str, listing_url: Optional[str], raw: Dict[str, Any]
) -> Optional[str]:
    """
    Robust external_id extraction.
    Priority:
      1) raw["external_id"] / raw["externalId"] / raw["listing_id"] / raw["listingId"]
      2) parse from listing_url by source-specific patterns
    """
    direct = pick_first(raw, ["external_id", "externalId", "listing_id", "listingId"])

    if direct is None:
        # If scraper used "id" for listing id, accept only if numeric-looking
        maybe_id = raw.get("id")
        if isinstance(maybe_id, (int, float)) or (
            isinstance(maybe_id, str) and maybe_id.strip().isdigit()
        ):
            direct = maybe_id

    if direct is not None:
        s = clean_str(direct)
        if s:
            return s

    if not listing_url:
        return None

    url = listing_url.strip()
    src = (source or "").lower().strip()

    if src == "rightmove":
        m = RIGHTMOVE_ID_RE.search(url)
        if m:
            return m.group(1)
        nums = re.findall(r"\d{6,}", url)
        return nums[0] if nums else None

    if src == "zoopla":
        m = ZOOPLA_ID_RE_1.search(url)
        if m:
            return m.group(1)
        m2 = ZOOPLA_ID_RE_2.search(url)
        if m2:
            return m2.group(1)
        nums = re.findall(r"\d{6,}", url)
        return nums[0] if nums else None

    nums = re.findall(r"\d{6,}", url)
    return nums[0] if nums else None


# ----------------------------
# Payload building
# ----------------------------
SAFE_COLUMNS = {
    "id",
    "title",
    "price",
    "bedrooms",
    "bathrooms",
    "description",
    "location",
    "latitude",
    "longitude",
    "yield_percent",
    "roi_percent",
    "imageurl",
    "image_urls",
    "investment_type",
    "created_at",
    # JSONB payload for additive fields / schema drift.
    "data",
}

OPTIONAL_COLUMNS = {
    "external_id",
    "source",
    "url",
    "updated_at",
    # Optional columns (may not exist in all schemas).
    "property_type",
    "raw_property_type",
}


def _classify_investment_type(title: str | None, description: str | None) -> str:
    text = f"{title or ''} {description or ''}".lower()

    # Minimal, launch-safe heuristics. Prioritize explicit signals.
    hmo_signals = [
        "hmo",
        "licensed",
        "licenced",
        "rooms to let",
        "room to let",
        "rooms to rent",
        "room to rent",
    ]
    sa_signals = [
        "serviced accommodation",
        "airbnb",
        "short let",
        "short-let",
        "holiday let",
    ]
    flip_signals = [
        "auction",
        "modernisation",
        "modernization",
        "refurb",
        "refurbishment",
        "renovation",
        "cash buyers",
        "cash buyer",
        "project",
    ]
    commercial_signals = [
        "commercial",
        "retail unit",
        "shop",
        "warehouse",
    ]

    if any(s in text for s in hmo_signals):
        return "HMO"
    if any(s in text for s in sa_signals):
        return "SA"
    if any(s in text for s in commercial_signals):
        return "Commercial"
    if any(s in text for s in flip_signals):
        return "Flip"

    return "BTL"


def normalize_record(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
    source_key = normalize_source_value(source) or clean_str(source) or source

    def _norm_url(u: Any) -> str | None:
        if not isinstance(u, str):
            return None
        s = u.strip()
        if not s:
            return None
        if s.startswith("//"):
            return f"https:{s}"
        return s

    def _normalize_image_urls(value: Any) -> list[str]:
        if not value:
            return []
        if not isinstance(value, list):
            return []
        out: list[str] = []
        seen: set[str] = set()
        for v in value:
            u = _norm_url(v)
            if not u:
                continue
            if u in seen:
                continue
            seen.add(u)
            out.append(u)
        return out

    # Many scrapers expose the canonical listing URL under different keys.
    # Rightmove scraper uses `raw_url`.
    listing_url = _norm_url(
        pick_first(raw, ["listing_url", "url", "raw_url", "link", "href", "propertyUrl"])
    )
    agent_name = clean_str(
        pick_first(raw, ["agent_name", "branch_name", "advertiser_name", "agency_name", "agent"])
    )
    agent_phone = clean_str(pick_first(raw, ["agent_phone", "phone", "telephone", "contact_phone"]))
    agent_email = clean_str(pick_first(raw, ["agent_email", "email", "contact_email"]))

    # Preserve gallery photos when available.
    image_urls = clean_image_urls(
        _normalize_image_urls(
            pick_first(raw, ["image_urls", "imageUrls", "images", "photos", "gallery"])
        )
    )

    normalized: Dict[str, Any] = {
        "title": clean_str(pick_first(raw, ["title", "name", "headline"])),
        "location": clean_str(pick_first(raw, ["location", "address", "displayAddress", "area"])),
        "price": to_int(pick_first(raw, ["price", "price_value", "amount", "asking_price"])),
        "bedrooms": to_int(pick_first(raw, ["bedrooms", "beds", "num_bedrooms"])),
        "bathrooms": to_int(pick_first(raw, ["bathrooms", "baths", "num_bathrooms"])),
        "description": clean_str(pick_first(raw, ["description", "summary", "details"])),
        "latitude": to_float(pick_first(raw, ["latitude", "lat"])),
        "longitude": to_float(pick_first(raw, ["longitude", "lng", "lon", "long"])),
        "yield_percent": to_float(pick_first(raw, ["yield_percent", "yield", "gross_yield"])),
        "roi_percent": to_float(pick_first(raw, ["roi_percent", "roi", "return_on_investment"])),
        "imageurl": clean_str(
            pick_first(raw, ["imageurl", "image_url", "image", "photo", "thumbnail"])
        ),
        "image_urls": image_urls if image_urls else None,
        "investment_type": clean_str(pick_first(raw, ["investment_type", "strategy", "type"])),
        "created_at": clean_str(pick_first(raw, ["created_at", "scraped_at", "timestamp"])),
        # optional
        "external_id": extract_external_id(source=source_key, listing_url=listing_url, raw=raw),
        "source": clean_str(source_key),
        # DB schema uses `url`; prefer it as the single canonical field.
        "url": listing_url,
        # Preserve the real source URL for investor handoff when DB columns exist.
        "source_url": listing_url,
        "original_listing_url": listing_url,
        "agent_name": agent_name,
        "agent_phone": agent_phone,
        "agent_email": agent_email,
    }

    # Property type classification: deterministic + additive.
    # We always embed into `data` (safe fallback). If DB columns exist, we also
    # populate top-level property_type/raw_property_type.
    try:
        raw_type_candidate = pick_first(
            raw,
            [
                "raw_property_type",
                "property_type",
                "propertyType",
                "propertyTypeLabel",
                "propertySubType",
                "type",
                "typeLabel",
            ],
        )
        raw_type_s = raw_type_candidate if isinstance(raw_type_candidate, str) else None
        prop_type, raw_type_best = classify_property_type(
            normalized.get("title"),
            normalized.get("description"),
            raw_type_s,
            extra=raw,
        )

        normalized["property_type"] = prop_type
        if raw_type_best:
            normalized["raw_property_type"] = raw_type_best

        data_obj = normalized.get("data")
        if not isinstance(data_obj, dict):
            data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
        data_obj["property_type"] = prop_type
        if raw_type_best:
            data_obj["raw_property_type"] = raw_type_best
        normalized["data"] = data_obj
    except Exception:
        pass

    # If imageurl is missing, promote a cover from image_urls.
    if not normalized.get("imageurl") and image_urls:
        normalized["imageurl"] = image_urls[0]

    # Ensure scraped listings have a stable investment_type tag for filtering.
    # If the source does not provide one, infer from the title/description.
    if not normalized.get("investment_type"):
        normalized["investment_type"] = _classify_investment_type(
            normalized.get("title"), normalized.get("description")
        )

    # Postcode enrichment from already-fetched/direct-source payload fields only.
    # Never downgrade a full postcode to an outward code.
    try:
        postcode_candidate = extract_best_postcode({**raw, **normalized, "raw": raw})
        if should_replace_postcode(normalized.get("postcode"), postcode_candidate):
            normalized["postcode"] = postcode_candidate.value
        data_obj = normalized.get("data")
        if not isinstance(data_obj, dict):
            data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
        data_obj["postcode_source"] = postcode_candidate.source
        data_obj["postcode_quality"] = postcode_candidate.quality
        normalized["data"] = data_obj
    except Exception:
        pass

    # Deal signals (investor feed): best-effort, additive.
    try:
        extracted = extract_deal_signals(normalized)
        if isinstance(extracted, dict):
            normalized["deal_signals"] = extracted.get("signals")
            normalized["deal_reasons"] = extracted.get("reasons")
            normalized["discount_estimate_pct"] = extracted.get("discount_estimate_pct")
            normalized["deal_signals_meta"] = {
                "confidence": extracted.get("confidence"),
                "matched_terms": extracted.get("matched_terms"),
            }

            lease_years_remaining = extracted.get("lease_years_remaining")
            if lease_years_remaining is not None:
                data_obj = normalized.get("data")
                if not isinstance(data_obj, dict):
                    data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
                data_obj["lease_years_remaining"] = lease_years_remaining
                normalized["data"] = data_obj
    except Exception:
        pass

    # Remove nulls so we don't overwrite good data with null
    return {k: v for k, v in normalized.items() if v is not None}


def backfill_investment_type(
    sb: Client,
    *,
    table: str = DEFAULT_TABLE,
    batch_size: int = 500,
    max_rows: int | None = None,
    dry_run: bool = False,
) -> None:
    """Backfill missing investment_type for existing DB rows.

    Safety:
    - Only targets rows where investment_type is NULL (and tries to include empty string too).
    - Writes only {id, investment_type} via upsert.
    """

    processed = 0
    total_updates = 0
    offset = 0

    cols = "id,title,description,investment_type"

    while True:
        remaining = None if max_rows is None else max(0, max_rows - processed)
        if remaining == 0:
            break

        page_size = batch_size if remaining is None else min(batch_size, remaining)

        try:
            # Prefer including empty strings too (some scrapers may write "").
            query = (
                sb.table(table)
                .select(cols)
                .or_("investment_type.is.null,investment_type.eq.")
                .range(offset, offset + page_size - 1)
            )
            resp = query.execute()
        except Exception:
            resp = (
                sb.table(table)
                .select(cols)
                .is_("investment_type", "null")
                .range(offset, offset + page_size - 1)
                .execute()
            )

        rows = resp.data or []
        if not rows:
            break

        updates: List[Dict[str, Any]] = []
        for r in rows:
            pid = r.get("id")
            if not pid:
                continue
            inv = _classify_investment_type(r.get("title"), r.get("description"))
            updates.append({"id": pid, "investment_type": inv})

        if updates:
            if dry_run:
                log(f"DRY-RUN: would backfill {len(updates)} rows (showing up to 5): {updates[:5]}")
            else:
                sb.table(table).upsert(updates, on_conflict="id").execute()
                total_updates += len(updates)
                log(f"Backfilled investment_type for {len(updates)} rows")

        processed += len(rows)
        offset += len(rows)

    log(f"Backfill complete. Processed={processed}, Updated={total_updates}")


# ----------------------------
# Upsert logic with fallback
# ----------------------------
@dataclass
class UpsertPlan:
    allowed_columns: List[str]
    on_conflict: Optional[str]


def build_upsert_plan(prefer_optional: bool = True) -> UpsertPlan:
    if prefer_optional:
        allowed = sorted(SAFE_COLUMNS.union(OPTIONAL_COLUMNS))
        return UpsertPlan(allowed_columns=allowed, on_conflict="source,external_id")
    allowed = sorted(SAFE_COLUMNS)
    return UpsertPlan(allowed_columns=allowed, on_conflict="id")


def filter_payload(records: List[Dict[str, Any]], allowed_cols: List[str]) -> List[Dict[str, Any]]:
    allowed = set(allowed_cols)
    return [{k: v for k, v in r.items() if k in allowed} for r in records]


def is_unknown_column_error(msg: str) -> bool:
    s = msg.lower()
    return ("could not find the" in s and "column" in s) or (
        "does not exist" in s and "column" in s
    )


def upsert_with_retry(
    sb: Client,
    table: str,
    records: List[Dict[str, Any]],
    on_conflict: Optional[str],
    max_retries: int = 2,
) -> Tuple[bool, Optional[str]]:
    if not records:
        return True, None

    last_err: Optional[str] = None
    for attempt in range(max_retries + 1):
        try:
            q = (
                sb.table(table).upsert(records, on_conflict=on_conflict)
                if on_conflict
                else sb.table(table).upsert(records)
            )
            q.execute()
            return True, None
        except Exception as e:
            last_err = str(e)
            if attempt < max_retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            return False, last_err
    return False, last_err


def chunked(xs: List[Dict[str, Any]], size: int) -> Iterable[List[Dict[str, Any]]]:
    for i in range(0, len(xs), size):
        yield xs[i : i + size]


def ingest(
    sb: Client,
    table: str,
    source: str,
    raw_records: List[Dict[str, Any]],
    dry_run: bool = False,
    batch_size: int = 200,
) -> None:
    log(f"Loaded {len(raw_records)} raw records")

    normalized = [normalize_record(r, source=source) for r in raw_records]
    normalized = [r for r in normalized if r.get("title") or r.get("location") or r.get("price")]

    log(f"Normalized {len(normalized)} records (after dropping empty rows)")

    if dry_run:
        log(
            "Dry-run enabled. Showing up to 3 normalized records:\n"
            + json.dumps(normalized[:3], indent=2)[:4000]
        )
        return

    plan_a = build_upsert_plan(prefer_optional=True)
    payload_a = filter_payload(normalized, plan_a.allowed_columns)

    total_ok = 0
    total_fail = 0

    for batch in chunked(payload_a, batch_size):
        ok, e = upsert_with_retry(sb, table, batch, plan_a.on_conflict)
        if ok:
            total_ok += len(batch)
            continue

        if e and is_unknown_column_error(e):
            warn(
                "DB rejected optional columns (external_id/source/url). Retrying with SAFE_COLUMNS only…"
            )
            plan_b = build_upsert_plan(prefer_optional=False)
            payload_b = filter_payload(batch, plan_b.allowed_columns)
            ok2, e2 = upsert_with_retry(sb, table, payload_b, plan_b.on_conflict)
            if ok2:
                total_ok += len(batch)
                continue
            total_fail += len(batch)
            err(f"Batch failed even after fallback: {e2}")
        else:
            total_fail += len(batch)
            err(f"Batch failed: {e}")

    log(f"Done. Upserted OK={total_ok}, Failed={total_fail} into '{table}'")


# ============================================================
# Async scraping helper (RESTORED EXPORT for backwards compat)
# ============================================================
# Some routes/tests expect: from backend.utils.ingest import scrape_all_sources
# Keep this function present to avoid ImportError in CI and runtime.
# We use lazy imports so missing optional scraper deps won't crash imports.


async def scrape_all_sources(
    location: str,
    *,
    sources: list[str] | None = None,
    zoopla_max_pages: int | None = None,
    onthemarket_max_pages: int | None = None,
    timeout_s: float | None = None,
    on_source_complete: Any | None = None,
) -> List[Dict[str, Any]]:
    """Backwards-compatible async aggregator.

    Tries to scrape supported sources and normalizes them into a single list.

    IMPORTANT:
    - Uses lazy imports (inside function) to avoid ImportError at module import-time.
    - If a scraper isn't available (or deps missing), we log and continue.
    """

    import inspect

    base_timeout_s = (
        float(timeout_s)
        if timeout_s is not None
        else float(os.getenv("INGEST_TIMEOUT_SECONDS", os.getenv("SCRAPER_TIMEOUT_SECONDS", "20")))
    )

    # SpareRoom is rentals/rooms, not sales listings. Keep the code available for
    # a future rentals pipeline, but skip it by default in production.
    env_name = (
        (
            os.getenv("ENVIRONMENT")
            or os.getenv("RAILWAY_ENVIRONMENT")
            or os.getenv("NODE_ENV")
            or ""
        )
        .strip()
        .lower()
    )
    is_production = env_name == "production"
    pipeline_mode = (os.getenv("PIPELINE_MODE") or "sales").strip().lower()
    allow_spareroom = (os.getenv("ENABLE_SPAREROOM_SALES") or "false").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    skip_spareroom = is_production and pipeline_mode == "sales" and not allow_spareroom

    loc = (location or "").strip()
    if not loc:
        return []

    selected: set[str] | None = None
    if sources is not None:
        selected = {str(s).strip().lower() for s in sources if str(s).strip()}
        if not selected:
            return []

    async def _collect_from(
        source: str, items: Any
    ) -> tuple[List[Dict[str, Any]], str, str | None, dict[str, Any] | None]:
        if inspect.isawaitable(items):
            try:
                # OTM has its own per-detail timeouts; allow longer here so partial
                # success isn't cut off by the aggregator.
                effective_timeout = base_timeout_s
                if (source or "").lower() == "onthemarket":
                    effective_timeout = max(
                        float(base_timeout_s),
                        float(os.getenv("OTM_SOURCE_TIMEOUT_S", "180")),
                    )
                items = await asyncio.wait_for(items, timeout=float(effective_timeout))
            except asyncio.TimeoutError:
                log(f"INFO: {source} timed out after {effective_timeout}s for location={loc}")
                return [], "timeout", None, None

        telemetry: dict[str, Any] | None = None
        # Some scrapers may optionally return (items, telemetry).
        if (
            isinstance(items, tuple)
            and len(items) == 2
            and isinstance(items[0], list)
            and isinstance(items[1], dict)
        ):
            telemetry = items[1]
            items = items[0]

        if not isinstance(items, list):
            return [], "error", "non-list result", telemetry

        if len(items) == 0:
            log(f"INFO: {source} returned 0 properties for location={loc}")
            return [], "empty", None, telemetry

        out: List[Dict[str, Any]] = []
        for raw in items:
            if isinstance(raw, dict):
                out.append(normalize_record(raw, source=source))
        return out, "success", None, telemetry

    tasks: List[
        asyncio.Task[tuple[str, List[Dict[str, Any]], str, str | None, dict[str, Any] | None]]
    ] = []

    async def _run_source(
        source: str, items: Any
    ) -> tuple[str, List[Dict[str, Any]], str, str | None, dict[str, Any] | None]:
        try:
            out, status, error, telemetry = await _collect_from(source, items)
            return source, out, status, error, telemetry
        except Exception as e:
            name = type(e).__name__
            if source == "onthemarket" and name.lower().endswith("blockederror"):
                return source, [], "blocked", str(e) or "blocked", None
            return source, [], "error", str(e), None

    # ---- Rightmove ----
    if selected is None or "rightmove" in selected:
        try:
            try:
                from backend.scraper.rightmove_scraper import (  # type: ignore
                    scrape_rightmove_properties,
                )
            except Exception:
                from scraper.rightmove_scraper import scrape_rightmove_properties  # type: ignore

            if inspect.iscoroutinefunction(scrape_rightmove_properties):
                items = scrape_rightmove_properties(loc)
            else:
                items = asyncio.to_thread(scrape_rightmove_properties, loc)
            tasks.append(asyncio.create_task(_run_source("rightmove", items)))
        except Exception as e:
            warn(f"Rightmove scrape skipped/failed: {e}")

    # ---- Zoopla ----
    if selected is None or "zoopla" in selected:
        try:
            try:
                from backend.scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore
            except Exception:
                from scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore

            if inspect.iscoroutinefunction(scrape_zoopla_properties):
                items = scrape_zoopla_properties(loc, max_pages=zoopla_max_pages)
            else:
                items = asyncio.to_thread(scrape_zoopla_properties, loc, max_pages=zoopla_max_pages)
            tasks.append(asyncio.create_task(_run_source("zoopla", items)))
        except Exception as e:
            warn(f"Zoopla scrape skipped/failed: {e}")

    # ---- OnTheMarket ----
    if selected is None or "onthemarket" in selected:
        try:
            try:
                from backend.scraper.onthemarket_scraper import (  # type: ignore
                    scrape_onthemarket_properties,
                )
            except Exception:
                from scraper.onthemarket_scraper import (
                    scrape_onthemarket_properties,  # type: ignore
                )

            if inspect.iscoroutinefunction(scrape_onthemarket_properties):
                items = scrape_onthemarket_properties(
                    loc, max_pages=onthemarket_max_pages, return_telemetry=True
                )
            else:
                items = asyncio.to_thread(
                    scrape_onthemarket_properties,
                    loc,
                    max_pages=onthemarket_max_pages,
                )
            tasks.append(asyncio.create_task(_run_source("onthemarket", items)))
        except Exception as e:
            warn(f"OnTheMarket scrape skipped/failed: {e}")

    # ---- SpareRoom (rentals/rooms; disabled for production sales) ----
    if (selected is not None and "spareroom" not in selected) or skip_spareroom:
        log(
            "INFO: spareroom skipped (disabled for production sales pipeline; set ENABLE_SPAREROOM_SALES=true to override)"
        )
    else:
        try:
            try:
                from backend.scraper.spare_room_scraper import (  # type: ignore
                    scrape_spareroom_properties,
                )
            except Exception:
                from scraper.spare_room_scraper import scrape_spareroom_properties  # type: ignore

            if inspect.iscoroutinefunction(scrape_spareroom_properties):
                items = scrape_spareroom_properties(loc)
            else:
                items = asyncio.to_thread(scrape_spareroom_properties, loc)
            tasks.append(asyncio.create_task(_run_source("spareroom", items)))
        except Exception as e:
            warn(f"SpareRoom scrape skipped/failed: {e}")

    results: List[Dict[str, Any]] = []
    if tasks:
        # Stream results as sources finish so callers can surface progress.
        for fut in asyncio.as_completed(tasks):
            try:
                source, chunk, status, error, telemetry = await fut
            except Exception as e:
                warn(f"Scrape task failed: {e}")
                continue

            if on_source_complete:
                try:
                    try:
                        maybe = on_source_complete(source, chunk, status, error, telemetry)
                    except TypeError:
                        maybe = on_source_complete(source, chunk, status, error)
                    if inspect.isawaitable(maybe):
                        await maybe
                except Exception as e:
                    warn(f"on_source_complete failed: {e}")

            if isinstance(chunk, list):
                results.extend([r for r in chunk if isinstance(r, dict)])

    # Drop empty rows (match ingest() logic)
    results = [r for r in results if r.get("title") or r.get("location") or r.get("price")]

    return results


# ----------------------------
# CLI
# ----------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="Path to JSON list or NDJSON file")
    ap.add_argument("--source", help="Source name e.g. zoopla or rightmove")
    ap.add_argument(
        "--table", default=DEFAULT_TABLE, help="Supabase table name (default: properties)"
    )
    ap.add_argument(
        "--dry-run", action="store_true", help="Print normalized output, do not write to DB"
    )
    ap.add_argument("--batch-size", type=int, default=200, help="Upsert batch size (default: 200)")
    ap.add_argument(
        "--backfill-investment-type",
        action="store_true",
        help="Backfill missing investment_type in the DB (does not require --input)",
    )
    ap.add_argument(
        "--backfill-limit",
        type=int,
        default=0,
        help="Optional max rows to process during backfill (0 = no limit)",
    )
    args = ap.parse_args()

    sb = get_supabase_client()

    if args.backfill_investment_type:
        backfill_investment_type(
            sb,
            table=args.table,
            batch_size=max(50, int(args.batch_size)),
            max_rows=None if int(args.backfill_limit) <= 0 else int(args.backfill_limit),
            dry_run=bool(args.dry_run),
        )
        return

    if not args.input or not args.source:
        raise SystemExit(
            "--input and --source are required unless --backfill-investment-type is set"
        )

    records = load_records(args.input)
    if not records:
        warn("No records found to ingest.")
        return

    ingest(
        sb=sb,
        table=args.table,
        source=args.source,
        raw_records=records,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        err(str(e))
        sys.exit(1)
