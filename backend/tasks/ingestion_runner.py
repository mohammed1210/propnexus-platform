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
from typing import Any, List, Optional

try:
    # Load environment variables from .env and .env.local at repo root if present
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()  # .env
    load_dotenv(".env.local", override=True)  # .env.local
except Exception:
    pass

from backend.utils.deal_scoring import compute_deal_score
from backend.utils.ingest import scrape_all_sources
from backend.utils.ppd_comps import get_sold_comps_summary
from backend.utils.scrape_runs import create_scrape_run, finish_scrape_run
from backend.utils.supabase_client import get_supabase
from backend.utils.top_deal_ranker import apply_top_deal_ranking

sb = get_supabase(required=False)

DEFAULT_DIRECT_SOURCES = ["zoopla", "onthemarket", "spareroom"]
_STATUS: dict[str, Any] = {
    "latest_run_id": None,
    "last_started_at": None,
    "last_finished_at": None,
    "last_total_imported": 0,
    "last_error": None,
    "sources": {},
}


def _load_locations() -> List[str]:
    raw = os.getenv("INGEST_LOCATIONS", "London,Manchester,Liverpool,Birmingham")
    return [part.strip() for part in raw.split(",") if part.strip()]


def _load_sources() -> List[str]:
    raw = os.getenv("INGEST_SOURCES")
    if not raw:
        return list(DEFAULT_DIRECT_SOURCES)
    return [part.strip().lower() for part in raw.split(",") if part.strip()]


def get_ingestion_status_snapshot() -> dict[str, Any]:
    return dict(_STATUS)


def _chunk(items, size=100):
    return [items[i : i + size] for i in range(0, len(items), size)]


async def _ingest_location(
    location: str, *, limit: Optional[int] = None, sources: Optional[List[str]] = None
) -> int:
    """Scrape+upsert for a single location. Returns count of rows processed."""
    start = time.time()
    run_id = create_scrape_run(source="direct", location=location, status="started")
    run_label = run_id or f"local-{int(start)}"
    selected_sources = sources or _load_sources()
    source_counts: dict[str, int] = {source: 0 for source in selected_sources}
    _STATUS.update(
        {
            "latest_run_id": run_label,
            "last_started_at": datetime.now(timezone.utc).isoformat(),
            "last_finished_at": None,
            "last_error": None,
        }
    )

    async def _source_complete(
        source: str,
        items: list[dict[str, Any]],
        status: str,
        error: str | None,
        telemetry: dict[str, Any] | None = None,
    ) -> None:
        count = len(items) if isinstance(items, list) else 0
        source_counts[source] = count
        classification = "degraded" if status in {"blocked", "timeout", "error"} else status
        _STATUS.setdefault("sources", {})[source] = {
            "location": location,
            "status": classification,
            "last_imported_count": count,
            "last_error": error,
            "telemetry": telemetry or {},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        logging.info(
            "[ingest] run_id=%s source=%s location=%s status=%s count=%s error=%s",
            run_label,
            source,
            location,
            classification,
            count,
            error,
        )

    try:
        normalized = await scrape_all_sources(
            location,
            sources=selected_sources,
            on_source_complete=_source_complete,
        )

        if limit is not None:
            try:
                lim = int(limit)
                if lim > 0:
                    normalized = normalized[:lim]
            except Exception:
                pass

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

                            try:
                                sold_comps = None
                                try:
                                    postcode_for_comps = row.get("postcode")
                                    if (
                                        sb
                                        and isinstance(postcode_for_comps, str)
                                        and postcode_for_comps.strip()
                                    ):
                                        sold_comps = get_sold_comps_summary(
                                            sb, postcode=postcode_for_comps, limit=20
                                        )
                                except Exception:
                                    sold_comps = None
                                row = apply_top_deal_ranking(row, sold_comps=sold_comps)
                            except Exception:
                                pass

                            # Final guardrail: never send columns not present in Supabase schema.
                            allowed_columns = {
                                "id",
                                "external_id",
                                "source_id",
                                "title",
                                "description",
                                "price",
                                "bedrooms",
                                "bathrooms",
                                "property_type",
                                "address",
                                "postcode",
                                "latitude",
                                "longitude",
                                "source",
                                "url",
                                "source_url",
                                "original_listing_url",
                                "listing_url",
                                "property_url",
                                "external_url",
                                "original_url",
                                "rightmove_url",
                                "zoopla_url",
                                "onthemarket_url",
                                "agent_name",
                                "agency_name",
                                "branch_name",
                                "agent_phone",
                                "contact_phone",
                                "agent_email",
                                "contact_email",
                                "image_urls",
                                "data",
                                "yield_percent",
                                "roi_percent",
                                "investment_type",
                                "bmv",
                                "location",
                                "imageurl",
                                "last_seen_at",
                                "first_seen_at",
                                "initial_price",
                                "previous_price",
                                "last_price_change_at",
                                "price_change_count",
                                "price_history",
                                "created_at",
                                "updated_at",
                                "score",
                                "score_updated_at",
                                "score_breakdown",
                                "top_deal_score",
                                "top_deal_tier",
                                "top_deal_reasons",
                                "search_metadata",
                            }
                            from backend.utils.supabase_sanitize import sanitize_property_payload

                            row = sanitize_property_payload(row, allowed_columns)
                            db_batch.append(row)

                    # Ensure upsert resolves on (source,external_id) as a single param value
                    sb.table("properties").upsert(
                        db_batch, on_conflict="source,external_id"
                    ).execute()  # type: ignore
                except Exception as e:  # pragma: no cover
                    logging.warning("Upsert failed for batch (%s): %s", location, e)
        dur = (time.time() - start) * 1000
        finish_scrape_run(run_id=run_id, status="success", count_inserted=count)
        _STATUS.update(
            {
                "last_finished_at": datetime.now(timezone.utc).isoformat(),
                "last_total_imported": count,
                "last_duration_ms": round(dur),
                "last_error": None,
            }
        )
        logging.info(
            "[ingest] run_id=%s location=%s sources=%s imported=%d duration_ms=%.0f",
            run_label,
            location,
            ",".join(selected_sources),
            count,
            dur,
        )
        return count
    except Exception as e:  # pragma: no cover
        finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=str(e))
        _STATUS.update(
            {
                "last_finished_at": datetime.now(timezone.utc).isoformat(),
                "last_error": f"{type(e).__name__}: {e}",
            }
        )
        logging.exception(
            "[ingest] run_id=%s location=%s failed: %s", run_label, location, type(e).__name__
        )
        return 0


async def run_cycle() -> int:
    """Run one full ingestion cycle across all locations."""
    locations = _load_locations()
    sources = _load_sources()
    batch_sleep_ms = int(os.getenv("INGEST_BATCH_SLEEP_MS", "1500"))
    total = 0
    for loc in locations:
        try:
            total += await _ingest_location(loc, sources=sources)
        except Exception as e:  # pragma: no cover - defensive runner guard
            _STATUS["last_error"] = f"{loc}: {type(e).__name__}: {e}"
            logging.exception("[ingest] location failed but cycle will continue location=%s", loc)
        await asyncio.sleep(batch_sleep_ms / 1000.0)
    logging.info("[ingest] cycle complete sources=%s total=%d", ",".join(sources), total)
    return total


async def main() -> None:
    interval = int(os.getenv("INGEST_INTERVAL_SECONDS", "900"))
    once = os.getenv("INGEST_RUN_ONCE", "0") == "1"
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info(
        "Ingestion runner started (interval=%ss once=%s mode=%s sources=%s scraperapi_key=%s)",
        interval,
        once,
        os.getenv("SCRAPER_MODE", "direct"),
        ",".join(_load_sources()),
        "present" if os.getenv("SCRAPERAPI_KEY") else "absent",
    )

    while True:
        await run_cycle()
        if once:
            break
        logging.info("[ingest] next_run_wait_seconds=%s", interval)
        await asyncio.sleep(interval)


if __name__ == "__main__":  # pragma: no cover
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Ingestion runner stopped by user")
