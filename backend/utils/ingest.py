#!/usr/bin/env python3
"""
ingest.py — normalize scraped property records and upsert into Supabase.

✅ Handles Rightmove + Zoopla external_id extraction (fixes Zoopla regression)
✅ Normalizes common fields (price/bed/bath/lat/lng/yield/roi)
✅ Safe upsert with fallback if your DB does NOT have external_id/source/listing_url columns
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
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from dotenv import load_dotenv

from supabase import Client, create_client

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
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    return create_client(url, key)


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
    "investment_type",
    "created_at",
}

OPTIONAL_COLUMNS = {"external_id", "source", "listing_url", "url", "updated_at"}


def normalize_record(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
    listing_url = clean_str(pick_first(raw, ["listing_url", "url", "link", "href"]))

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
        "investment_type": clean_str(pick_first(raw, ["investment_type", "strategy", "type"])),
        "created_at": clean_str(pick_first(raw, ["created_at", "scraped_at", "timestamp"])),
        # optional
        "external_id": extract_external_id(source=source, listing_url=listing_url, raw=raw),
        "source": clean_str(source),
        "listing_url": listing_url,
    }

    # Remove nulls so we don't overwrite good data with null
    return {k: v for k, v in normalized.items() if v is not None}


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
                "DB rejected optional columns (external_id/source/listing_url). Retrying with SAFE_COLUMNS only…"
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


async def scrape_all_sources(location: str) -> List[Dict[str, Any]]:
    """Backwards-compatible async aggregator.

    Tries to scrape supported sources and normalizes them into a single list.

    IMPORTANT:
    - Uses lazy imports (inside function) to avoid ImportError at module import-time.
    - If a scraper isn't available (or deps missing), we log and continue.
    """

    import inspect

    loc = (location or "").strip()
    if not loc:
        return []

    results: List[Dict[str, Any]] = []

    async def _extend_from(source: str, items: Any) -> None:
        if inspect.isawaitable(items):
            items = await items
        if not isinstance(items, list):
            return
        for raw in items:
            if isinstance(raw, dict):
                results.append(normalize_record(raw, source=source))

    # ---- Rightmove ----
    try:
        try:
            from backend.scraper.rightmove_scraper import (  # type: ignore
                scrape_rightmove_properties,
            )
        except Exception:
            from scraper.rightmove_scraper import scrape_rightmove_properties  # type: ignore

        await _extend_from("rightmove", scrape_rightmove_properties(loc))
    except Exception as e:
        warn(f"Rightmove scrape skipped/failed: {e}")

    # ---- Zoopla ----
    try:
        try:
            from backend.scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore
        except Exception:
            from scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore

        await _extend_from("zoopla", scrape_zoopla_properties(loc))
    except Exception as e:
        warn(f"Zoopla scrape skipped/failed: {e}")

    # ---- OnTheMarket ----
    try:
        try:
            from backend.scraper.onthemarket_scraper import (  # type: ignore
                scrape_onthemarket_properties,
            )
        except Exception:
            from scraper.onthemarket_scraper import scrape_onthemarket_properties  # type: ignore

        await _extend_from("onthemarket", scrape_onthemarket_properties(loc))
    except Exception as e:
        warn(f"OnTheMarket scrape skipped/failed: {e}")

    # ---- SpareRoom ----
    try:
        try:
            from backend.scraper.spare_room_scraper import (  # type: ignore
                scrape_spareroom_properties,
            )
        except Exception:
            from scraper.spare_room_scraper import scrape_spareroom_properties  # type: ignore

        await _extend_from("spareroom", scrape_spareroom_properties(loc))
    except Exception as e:
        warn(f"SpareRoom scrape skipped/failed: {e}")

    # Drop empty rows (match ingest() logic)
    results = [r for r in results if r.get("title") or r.get("location") or r.get("price")]

    return results


# ----------------------------
# CLI
# ----------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Path to JSON list or NDJSON file")
    ap.add_argument("--source", required=True, help="Source name e.g. zoopla or rightmove")
    ap.add_argument(
        "--table", default=DEFAULT_TABLE, help="Supabase table name (default: properties)"
    )
    ap.add_argument(
        "--dry-run", action="store_true", help="Print normalized output, do not write to DB"
    )
    ap.add_argument("--batch-size", type=int, default=200, help="Upsert batch size (default: 200)")
    args = ap.parse_args()

    records = load_records(args.input)
    if not records:
        warn("No records found to ingest.")
        return

    sb = get_supabase_client()
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
