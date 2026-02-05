"""Continuous ingestion runner for property data.

Usage (development):
  python -m backend.tasks.ingestion_runner

Environment variables:
  INGEST_LOCATIONS          Comma-separated list of locations (default: London,Manchester,Liverpool,Birmingham)
  INGEST_INTERVAL_SECONDS   Delay between full cycles (default: 900 = 15m)
  INGEST_RUN_ONCE           If set to '1', run a single cycle then exit.
  INGEST_BATCH_SLEEP_MS     Sleep between individual location scrapes (default: 1500ms)

Relies on the unified scrape helpers in backend.utils.ingest and writes
normalized rows to the Supabase `properties` table in batches.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import List

try:
    # Load environment variables from .env and .env.local at repo root if present
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()  # .env
    load_dotenv(".env.local", override=True)  # .env.local
except Exception:
    pass

try:
    from supabase import create_client  # type: ignore
except Exception:  # pragma: no cover
    create_client = None  # type: ignore

from backend.utils.deal_scoring import compute_deal_score
from backend.utils.ingest import scrape_all_sources

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SCRAPER_MODE = os.getenv("SCRAPER_MODE", "direct").lower()

if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)  # type: ignore
    except Exception as e:  # pragma: no cover
        logging.warning("Supabase client init failed: %s", e)
        sb = None
else:  # pragma: no cover
    sb = None


def _load_locations() -> List[str]:
    raw = os.getenv("INGEST_LOCATIONS", "London,Manchester,Liverpool,Birmingham")
    return [part.strip() for part in raw.split(",") if part.strip()]


def _chunk(items, size=100):
    return [items[i : i + size] for i in range(0, len(items), size)]


async def _ingest_location(location: str) -> int:
    """Scrape+upsert for a single location. Returns count of rows processed."""
    start = time.time()
    try:
        normalized = await scrape_all_sources(location)
        count = len(normalized)
        if sb and normalized:
            for batch in _chunk(normalized):
                try:
                    db_batch = []
                    for p in batch:
                        if isinstance(p, dict):
                            row = dict(p)
                            row.pop("ai_ready", None)

                            try:
                                score, breakdown = compute_deal_score(row)
                                row["score"] = score
                                row["score_breakdown"] = breakdown
                                row["score_updated_at"] = datetime.now(timezone.utc).isoformat()
                            except Exception:
                                pass
                            db_batch.append(row)

                    # Ensure upsert resolves on (source,external_id) as a single param value
                    sb.table("properties").upsert(
                        db_batch, on_conflict="source,external_id"
                    ).execute()  # type: ignore
                except Exception as e:  # pragma: no cover
                    logging.warning("Upsert failed for batch (%s): %s", location, e)
        dur = (time.time() - start) * 1000
        logging.info("[ingest] %s -> %d properties (%.0f ms)", location, count, dur)
        return count
    except Exception as e:  # pragma: no cover
        logging.exception("[ingest] %s failed: %s", location, type(e).__name__)
        return 0


async def run_cycle() -> int:
    """Run one full ingestion cycle across all locations."""
    locations = _load_locations()
    batch_sleep_ms = int(os.getenv("INGEST_BATCH_SLEEP_MS", "1500"))
    total = 0
    for loc in locations:
        total += await _ingest_location(loc)
        await asyncio.sleep(batch_sleep_ms / 1000.0)
    logging.info("[ingest] cycle complete total=%d", total)
    return total


async def main() -> None:
    interval = int(os.getenv("INGEST_INTERVAL_SECONDS", "900"))
    once = os.getenv("INGEST_RUN_ONCE", "0") == "1"
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("Ingestion runner started (interval=%ss once=%s)", interval, once)

    while True:
        await run_cycle()
        if once:
            break
        await asyncio.sleep(interval)


if __name__ == "__main__":  # pragma: no cover
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Ingestion runner stopped by user")
