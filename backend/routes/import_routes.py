# backend/routes/import_routes.py
from __future__ import annotations

import asyncio
import inspect
import logging
import os
import random
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import aiohttp
from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

try:
    from postgrest.exceptions import APIError  # type: ignore
except Exception:  # pragma: no cover
    APIError = Exception  # type: ignore

from backend.scraper.utils import TARGET_CITIES, fetch_detail_html_with_diag
from backend.utils.admin_auth import require_admin
from backend.utils.deal_scoring import compute_deal_score
from backend.utils.deal_signals import extract_deal_signals
from backend.utils.enrichment_queue import enqueue_job, enqueue_property_ids
from backend.utils.image_utils import (
    dedupe_image_urls,
    extract_image_urls_from_ld_json,
    extract_image_urls_from_next_data,
    extract_next_data_json,
    normalize_image_url,
    pick_cover_image,
)

# Scrapers (existing)
from backend.utils.ingest import (
    extract_postcode_from_text,
    normalize_media_urls,
    postcode_band,
    scrape_all_sources,
)
from backend.utils.listing_keys import (
    best_postcode,
    ensure_external_id,
    extract_postcode,
    is_full_postcode,
    strip_empty_for_upsert,
)
from backend.utils.postcode import get_lat_lng_from_postcode
from backend.utils.ppd_comps import get_sold_comps_summary
from backend.utils.property_type_classifier import classify_property_type
from backend.utils.scrape_runs import create_scrape_run, finish_scrape_run, update_scrape_run_data
from backend.utils.top_deal_ranker import apply_top_deal_ranking

# Shared Supabase client
try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None  # graceful if local-only

# Rate limiting (optional)
try:
    from backend.middleware.rate_limit import limiter
except Exception:
    limiter = None  # graceful if not available


router = APIRouter(prefix="/import", tags=["import"])

# Backwards-compatible alias router (no prefix)
admin_alias_router = APIRouter(tags=["import"])


_batch_logger = logging.getLogger(__name__)


def _create_durable_batch_run(*, cities: list[str]) -> str:
    """Create a durable batch id in Supabase (scrape_runs).

    If Supabase is configured but the row cannot be created, fail fast so we never
    return a batch_id that later becomes "Unknown batch_id".
    """

    batch_id = str(uuid.uuid4())
    if not sb:
        return batch_id

    payload: dict[str, Any] = {
        "id": batch_id,
        "source": "batch",
        "location": f"{len(cities)} cities",
        "status": "queued",
        "started_at": _now_iso(),
    }
    try:
        sb.table("scrape_runs").insert(payload).execute()
        return batch_id
    except Exception:
        # Fall back to helper (may return server-generated id)
        run_id = create_scrape_run(
            source="batch", location=f"{len(cities)} cities", status="queued"
        )
        if run_id:
            return str(run_id)
        raise HTTPException(status_code=500, detail="Failed to create durable batch run")


async def _persist_batch_snapshot(
    batch_id: str,
    snapshot: dict[str, Any],
    *,
    status: str,
    error: str | None = None,
) -> None:
    """Persist batch job snapshot to scrape_runs.data.

    This must never block the event loop (Supabase client is sync), so it runs in a thread.
    """

    if not sb:
        return
    try:
        await asyncio.to_thread(
            update_scrape_run_data,
            run_id=batch_id,
            data=snapshot,
            status=status,
            count_inserted=int(snapshot.get("total_imported") or 0),
            error=error,
        )
    except Exception:
        return


def _queue_batch_job(
    *,
    batch_id: str,
    cities: list[str],
    sources: list[str],
    max_pages: int,
    delay_min_s: float,
    delay_max_s: float,
    per_city_timeout_s: float,
    enrich: bool = False,
    enrich_limit: int = 5,
    initial_snapshot: dict[str, Any] | None = None,
) -> None:
    async def _runner() -> None:
        started_mono = time.monotonic()
        _batch_logger.info(
            "batch_start batch_id=%s cities=%s sources=%s per_city_timeout_s=%.1f",
            batch_id,
            len(cities),
            ",".join(sources),
            float(per_city_timeout_s or 0),
        )

        snapshot: dict[str, Any] = dict(initial_snapshot or {})
        snapshot["batch_id"] = batch_id
        snapshot["status"] = "running"
        await _persist_batch_snapshot(batch_id, snapshot, status="running")

        total_scraped = 0
        total_imported = 0
        had_error = False
        had_timeout = False
        for i, city in enumerate(cities):
            per_city = snapshot.get("per_city")
            if not isinstance(per_city, dict):
                per_city = {}
                snapshot["per_city"] = per_city

            entry = per_city.get(city)
            if not isinstance(entry, dict):
                entry = {}
                per_city[city] = entry

            entry.update({"status": "running", "scraped": 0, "imported": 0, "error": None})
            src_map = entry.get("sources")
            if not isinstance(src_map, dict):
                src_map = {}
                entry["sources"] = src_map
            for source in sources:
                src_map[source] = {"status": "running", "scraped": 0, "imported": 0, "error": None}

            await _persist_batch_snapshot(batch_id, snapshot, status="running")

            city_started = time.monotonic()
            _batch_logger.info(
                "batch_city_start batch_id=%s city=%s idx=%s/%s per_city_timeout_s=%.1f",
                batch_id,
                city,
                i + 1,
                len(cities),
                float(per_city_timeout_s or 0),
            )
            try:

                async def _do_city() -> tuple[list[Any], int, str | None]:
                    city_scraped_by_source: dict[str, int] = {s: 0 for s in sources}

                    async def _on_source_complete(
                        source: str,
                        items: list[dict[str, Any]],
                        status: str,
                        error: str | None,
                        telemetry: dict[str, Any] | None = None,
                    ) -> None:
                        scraped_local = len(items) if isinstance(items, list) else 0
                        if source in city_scraped_by_source:
                            city_scraped_by_source[source] = scraped_local

                        normalized_status = (status or "success").lower()

                        # Default mapping for non-OTM sources.
                        src_status = "success"
                        src_error: str | None = error
                        if normalized_status in ("timeout", "blocked"):
                            src_status = "error"
                            src_error = error or normalized_status
                        elif normalized_status == "error":
                            src_status = "error"
                            src_error = error or "error"

                        # OTM-specific: detail timeouts are partial (not fatal) when we got results.
                        if source == "onthemarket":
                            if scraped_local > 0:
                                src_status = "success"
                                # Avoid labeling as timeout when some results exist.
                                if src_error and str(src_error).lower().startswith("timeout"):
                                    src_error = None
                            else:
                                # 0 results should be recorded as completed with 0, not timeout.
                                if normalized_status in ("timeout", "blocked", "error"):
                                    src_status = "error"
                                    src_error = src_error or normalized_status
                                else:
                                    src_status = "success"
                                    src_error = None

                        patch: dict[str, Any] = {
                            "status": src_status,
                            "scraped": scraped_local,
                            "imported": 0,
                            "error": src_error,
                        }

                        if source == "onthemarket" and isinstance(telemetry, dict):
                            # Thread detail-phase counters into status for observability.
                            for k in (
                                "detail_links_found",
                                "property_ids_found",
                                "detail_fetch_attempted",
                                "detail_fetch_succeeded",
                                "detail_fetch_timed_out",
                                "detail_fetch_failed",
                                "detail_fetch_elapsed_ms",
                            ):
                                if k in telemetry:
                                    patch[k] = telemetry.get(k)
                            patch["partial_success"] = bool(
                                int(telemetry.get("detail_fetch_succeeded") or 0) > 0
                                and int(telemetry.get("detail_fetch_timed_out") or 0) > 0
                            )

                        per_city_local = snapshot.get("per_city")
                        if isinstance(per_city_local, dict):
                            ce = per_city_local.get(city)
                            if isinstance(ce, dict):
                                srcs_local = ce.get("sources")
                                if isinstance(srcs_local, dict):
                                    srcs_local[source] = patch
                                ce["scraped"] = sum(city_scraped_by_source.values())

                        await _persist_batch_snapshot(batch_id, snapshot, status="running")

                        _batch_logger.info(
                            "batch_source_done batch_id=%s city=%s source=%s status=%s scraped=%s error=%s elapsed_s=%.2f",
                            batch_id,
                            city,
                            source,
                            src_status,
                            scraped_local,
                            (src_error or ""),
                            time.monotonic() - city_started,
                        )

                    raw = await _maybe_await(
                        asyncio.wait_for(
                            scrape_all_sources(
                                city,
                                sources=sources,
                                zoopla_max_pages=max_pages,
                                onthemarket_max_pages=max_pages,
                                timeout_s=(
                                    float(per_city_timeout_s)
                                    if float(per_city_timeout_s or 0) > 0
                                    else None
                                ),
                                on_source_complete=_on_source_complete,
                            ),
                            timeout=max(1.0, float(per_city_timeout_s or 0)),
                        )
                    )
                    items_local: list[Any] = raw if isinstance(raw, list) else []

                    imported_local = 0
                    db_error_local: str | None = None
                    if items_local:
                        now_iso = _now_iso()
                        db_rows = [
                            _clean_row(p, now_iso) for p in items_local if isinstance(p, dict)
                        ]
                        ok, db_error_local = _upsert_properties_rows(rows=db_rows)
                        imported_local = len(db_rows) if ok else 0
                        if ok and imported_local > 0:
                            # Auto-enqueue enrichment jobs (best-effort; never fail batch).
                            try:
                                ids = [
                                    str(r.get("id")).strip()
                                    for r in db_rows
                                    if isinstance(r, dict)
                                    and isinstance(r.get("id"), str)
                                    and str(r.get("id") or "").strip()
                                ]
                                enq = 0
                                if ids:
                                    enq = int(
                                        enqueue_property_ids(
                                            ids,
                                            reason=f"post_import:batch_async:{city}",
                                        ).get("enqueued")
                                        or 0
                                    )
                                else:
                                    by_source: dict[str, list[dict[str, Any]]] = {}
                                    for r in db_rows:
                                        if not isinstance(r, dict):
                                            continue
                                        src = str(r.get("source") or "").strip().lower()
                                        if not src:
                                            continue
                                        by_source.setdefault(src, []).append(r)
                                    for src, src_rows in by_source.items():
                                        enq += _enqueue_enrichment_for_rows(
                                            source=src, rows=src_rows
                                        )

                                if enq:
                                    _batch_logger.info(
                                        "enrich_auto_enqueue route=import_batch_async reason=post_import:batch_async city=%s enqueued=%s",
                                        city,
                                        enq,
                                    )
                            except Exception:
                                pass
                        if ok and enrich and imported_local > 0:
                            asyncio.create_task(
                                _enrich_rows_best_effort(
                                    rows=db_rows,
                                    max_items=int(enrich_limit),
                                )
                            )
                    return items_local, imported_local, db_error_local

                items, imported, db_error = await _do_city()

                scraped = len(items)
                total_scraped += scraped

                db_upsert_ok = db_error is None
                total_imported += int(imported or 0)

                city_status = "success" if db_upsert_ok else "error"
                city_error = None if db_upsert_ok else db_error
                if city_status == "error":
                    had_error = True
                    if city_error and str(city_error).lower().startswith("timeout"):
                        had_timeout = True

                per_city_local = snapshot.get("per_city")
                if isinstance(per_city_local, dict):
                    ce = per_city_local.get(city)
                    if isinstance(ce, dict):
                        ce.update(
                            {
                                "scraped": scraped,
                                "imported": int(imported or 0),
                                "status": city_status,
                                "error": city_error,
                            }
                        )
                snapshot["total_scraped"] = total_scraped
                snapshot["total_imported"] = total_imported
                await _persist_batch_snapshot(batch_id, snapshot, status="running")

                _batch_logger.info(
                    "batch_city_done batch_id=%s city=%s status=%s scraped=%s imported=%s elapsed_s=%.2f",
                    batch_id,
                    city,
                    city_status,
                    scraped,
                    int(imported or 0),
                    time.monotonic() - city_started,
                )
            except asyncio.TimeoutError:
                had_error = True
                had_timeout = True
                per_city_local = snapshot.get("per_city")
                if isinstance(per_city_local, dict):
                    ce = per_city_local.get(city)
                    if isinstance(ce, dict):
                        ce.update(
                            {"scraped": 0, "imported": 0, "status": "error", "error": "timeout"}
                        )
                        srcs_local = ce.get("sources")
                        if isinstance(srcs_local, dict):
                            for src in list(srcs_local.keys()):
                                se = srcs_local.get(src)
                                if isinstance(se, dict):
                                    se["status"] = "error"
                                    se["error"] = "timeout"
                snapshot["total_scraped"] = total_scraped
                snapshot["total_imported"] = total_imported
                await _persist_batch_snapshot(batch_id, snapshot, status="running", error="timeout")
                _batch_logger.warning(
                    "batch_city_timeout batch_id=%s city=%s per_city_timeout_s=%.1f elapsed_s=%.2f",
                    batch_id,
                    city,
                    float(per_city_timeout_s or 0),
                    time.monotonic() - city_started,
                )
            except asyncio.CancelledError:
                # Surface cancellation cleanly; this can happen during shutdown.
                had_error = True
                per_city_local = snapshot.get("per_city")
                if isinstance(per_city_local, dict):
                    ce = per_city_local.get(city)
                    if isinstance(ce, dict):
                        ce.update(
                            {
                                "scraped": 0,
                                "imported": 0,
                                "status": "error",
                                "error": "CancelledError",
                            }
                        )
                        srcs_local = ce.get("sources")
                        if isinstance(srcs_local, dict):
                            for src in list(srcs_local.keys()):
                                se = srcs_local.get(src)
                                if isinstance(se, dict):
                                    se["status"] = "error"
                                    se["error"] = "CancelledError"
                snapshot["status"] = "error"
                snapshot["error"] = "CancelledError"
                await _persist_batch_snapshot(
                    batch_id, snapshot, status="error", error="CancelledError"
                )
                raise
            except Exception as e:
                had_error = True
                err_s = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
                per_city_local = snapshot.get("per_city")
                if isinstance(per_city_local, dict):
                    ce = per_city_local.get(city)
                    if isinstance(ce, dict):
                        ce.update({"scraped": 0, "imported": 0, "status": "error", "error": err_s})
                        srcs_local = ce.get("sources")
                        if isinstance(srcs_local, dict):
                            for src in list(srcs_local.keys()):
                                se = srcs_local.get(src)
                                if isinstance(se, dict):
                                    se["status"] = "error"
                                    se["error"] = err_s
                snapshot["total_scraped"] = total_scraped
                snapshot["total_imported"] = total_imported
                await _persist_batch_snapshot(batch_id, snapshot, status="running", error=err_s)
                _batch_logger.exception(
                    "batch_city_error batch_id=%s city=%s elapsed_s=%.2f",
                    batch_id,
                    city,
                    time.monotonic() - city_started,
                )

            if i < len(cities) - 1:
                await asyncio.sleep(random.uniform(delay_min_s, delay_max_s))
        overall = "error" if had_error else "success"
        snapshot["status"] = overall
        snapshot["total_scraped"] = total_scraped
        snapshot["total_imported"] = total_imported
        if had_timeout:
            snapshot["error"] = "timeout"
        await _persist_batch_snapshot(
            batch_id, snapshot, status=overall, error=snapshot.get("error")
        )

        # Persist final status best-effort (offload sync client).
        try:
            await asyncio.to_thread(
                finish_scrape_run,
                run_id=batch_id,
                status=overall,
                count_inserted=total_imported,
                error=snapshot.get("error"),
            )
        except Exception:
            pass

        _batch_logger.info(
            "batch_done batch_id=%s status=%s total_scraped=%s total_imported=%s elapsed_s=%.2f",
            batch_id,
            overall,
            total_scraped,
            total_imported,
            time.monotonic() - started_mono,
        )

    _start_background_batch_runner(_runner())


def _start_background_batch_runner(coro: Any) -> None:
    """Run a coroutine in a dedicated daemon thread.

    FastAPI's TestClient can starve background tasks scheduled on the request loop.
    Using a dedicated thread makes batch execution independent from request handling.
    """

    def _run() -> None:
        try:
            asyncio.run(coro)
        except Exception:
            # Best-effort: runner failures are persisted by the runner itself.
            return

    t = threading.Thread(target=_run, name="import-batch-runner", daemon=True)
    t.start()


async def _maybe_await(result: Any) -> Any:
    if inspect.iscoroutine(result) or inspect.isawaitable(result):
        return await result
    return result


async def _fill_missing_coords_from_postcode(rows: list[Dict[str, Any]]) -> None:
    """Best-effort geocoding for rows missing coordinates.

    Rules:
    - If latitude/longitude are 0,0 treat as missing
    - If postcode exists and coords missing, resolve via backend.utils.postcode (cache-first)
    - Never raise; import should still succeed without coords
    """

    if not rows:
        return

    # Escape hatch for ops / CI.
    if (os.getenv("DISABLE_POSTCODE_GEOCODE") or "").strip() in ("1", "true", "yes"):
        return

    sem = asyncio.Semaphore(10)
    cache: dict[str, Dict[str, float] | None] = {}

    def _is_valid_coord(v: Any) -> bool:
        try:
            f = float(v)
        except Exception:
            return False
        return (f != 0.0) and (abs(f) > 1e-12)

    async def _resolve_for_row(row: Dict[str, Any]) -> None:
        try:
            lat_ok = _is_valid_coord(row.get("latitude"))
            lng_ok = _is_valid_coord(row.get("longitude"))
            if lat_ok and lng_ok:
                return

            pc = (
                extract_postcode(row.get("postcode"))
                or extract_postcode(row.get("address"))
                or extract_postcode(row.get("location"))
            )
            if not pc:
                return

            if pc in cache:
                coords = cache[pc]
            else:
                async with sem:
                    coords = await get_lat_lng_from_postcode(pc, use_db_cache=True)
                cache[pc] = coords

            if not coords:
                return
            lat = coords.get("latitude")
            lng = coords.get("longitude")
            if lat is None or lng is None:
                return

            # Only write if we got real coordinates.
            if float(lat) == 0.0 or float(lng) == 0.0:
                return

            row["latitude"] = float(lat)
            row["longitude"] = float(lng)
        except Exception:
            return

    await asyncio.gather(*[_resolve_for_row(r) for r in rows if isinstance(r, dict)])


async def _scrape_and_upsert(
    *,
    location: str,
    scrape_fn: Any,
    run_id: str | None = None,
    source: str | None = None,
) -> int:
    """Run scrape and upsert results, best-effort.

    Used by the optional `?async=true` mode on /import/* endpoints to avoid request
    timeouts in production.
    """

    if not run_id and source:
        run_id = create_scrape_run(source=source, location=location)

    scrape_error: str | None = None
    try:
        items = await _maybe_await(scrape_fn())
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []

    db_ok = False
    db_error: str | None = None
    inserted = 0
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        await _fill_missing_coords_from_postcode(db_rows)
        inserted = len(db_rows)
        if sb and db_rows:
            db_ok, db_error = _upsert_properties_rows(
                rows=db_rows, on_conflict="source,external_id"
            )

    if run_id:
        if db_ok:
            finish_scrape_run(run_id=run_id, status="success", count_inserted=inserted)
        else:
            finish_scrape_run(
                run_id=run_id,
                status="error",
                count_inserted=0,
                error=(db_error or scrape_error or "unknown"),
            )

    return len(items)


def _queue_scrape_and_upsert(
    *,
    location: str,
    scrape_fn: Any,
    run_id: str | None = None,
    source: str | None = None,
) -> None:
    asyncio.create_task(
        _scrape_and_upsert(location=location, scrape_fn=scrape_fn, run_id=run_id, source=source)
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_junk_image_url(u: Any) -> bool:
    s = (u or "").strip().lower() if isinstance(u, str) else ""
    if not s:
        return True

    # Zoopla static assets / logos / error placeholders
    if "zoopla_static_agent_logo" in s:
        return True
    if "/_next/static/" in s:
        return True
    if "error-image" in s:
        return True

    # OnTheMarket site assets (icons/backgrounds)
    # Keep floorplans (useful in gallery), but drop generic site icons.
    if "onthemarket.com/assets/images/" in s:
        return True
    if "map-pill.png" in s:
        return True

    # Third-party ad/agent product creatives commonly embedded in OTM pages
    if "agentsmutual.co.uk/agent-products/" in s:
        return True

    # SVGs are frequently logos/icons
    if s.endswith(".svg"):
        return True

    return False


def _filter_junk_image_urls(urls: List[str]) -> List[str]:
    """Remove common non-listing images (logos/icons/placeholders).

    Keep this intentionally conservative: only strip URLs that are very likely
    to be site chrome rather than actual listing photos.
    """

    if not urls:
        return []

    out: List[str] = []
    seen: set[str] = set()
    for u in urls:
        if not isinstance(u, str):
            continue
        if _is_junk_image_url(u):
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _clean_row(p: Dict[str, Any], now_iso: str) -> Dict[str, Any]:
    """
    Normalise a scraped property dict into something safe to upsert.
    - Adds last_seen_at
    - Removes fields not in DB schema (like ai_ready)
    - Leaves everything else intact
    """
    row = dict(p)
    row["last_seen_at"] = now_iso
    row.pop("ai_ready", None)

    def _norm_url(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if s.startswith("//"):
            return f"https:{s}"
        return s

    def _coerce_int(v: Any) -> int | None:
        if v is None:
            return None
        if isinstance(v, bool):
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

    def _coerce_float(v: Any) -> float | None:
        if v is None:
            return None
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v.strip())
            except Exception:
                return None
        return None

    # Optional hydration from `data.raw` when top-level fields are missing.
    data_obj = row.get("data")
    raw_obj: Dict[str, Any] = {}
    if isinstance(data_obj, dict):
        if isinstance(data_obj.get("raw"), dict):
            raw_obj = data_obj.get("raw")  # type: ignore[assignment]
        else:
            raw_obj = data_obj

    def _pick_raw(keys: List[str]) -> Any:
        for k in keys:
            v = raw_obj.get(k)
            if v not in (None, "", [], {}):
                return v
        return None

    # Map scraper field names into DB schema.
    if not row.get("imageurl"):
        row["imageurl"] = (
            row.get("image_url")
            or row.get("imageUrl")
            or _pick_raw(["imageurl", "image_url", "imageUrl", "image", "imageUrlLarge"])
        )
    row["imageurl"] = _norm_url(row.get("imageurl"))
    row.pop("image_url", None)
    row.pop("imageUrl", None)

    if isinstance(row.get("image_urls"), list):
        row["image_urls"] = [
            _norm_url(u) for u in row.get("image_urls") if isinstance(u, str) and u.strip()
        ]
    elif not row.get("image_urls"):
        raw_imgs = _pick_raw(["image_urls", "imageUrls", "images"])
        if isinstance(raw_imgs, list):
            row["image_urls"] = [_norm_url(u) for u in raw_imgs if isinstance(u, str) and u.strip()]

    # Strip site chrome from image_urls, and prefer a real photo for imageurl.
    if isinstance(row.get("image_urls"), list):
        # OTM gallery can be huge and include floorplans + webp/jpg duplicates.
        try:
            media = normalize_media_urls(row.get("image_urls") or [])
            if isinstance(media, dict):
                photos = (
                    media.get("image_urls") if isinstance(media.get("image_urls"), list) else []
                )
                floorplans = (
                    media.get("floorplan_urls")
                    if isinstance(media.get("floorplan_urls"), list)
                    else []
                )
                hero = media.get("imageurl") if isinstance(media.get("imageurl"), str) else None

                if photos:
                    row["image_urls"] = photos

                if floorplans:
                    data_obj = row.get("data")
                    if not isinstance(data_obj, dict):
                        data_obj = {}
                    # Backward-compatible: store floorplans under JSON data to avoid DB column mismatches.
                    data_obj["floorplan_urls"] = floorplans
                    row["data"] = data_obj

                if hero:
                    current = row.get("imageurl")
                    if not (isinstance(current, str) and current.strip()) or (
                        isinstance(current, str) and "/floor-plan-" in current
                    ):
                        row["imageurl"] = hero
        except Exception:
            pass

        filtered = _filter_junk_image_urls([u for u in row["image_urls"] if isinstance(u, str)])
        if filtered:
            row["image_urls"] = filtered
            # If imageurl is missing or looks like junk, promote first filtered image.
            current = row.get("imageurl")
            if (not isinstance(current, str)) or _is_junk_image_url(current):
                row["imageurl"] = filtered[0]

    # Ensure image_urls is always a list for DB + frontend compatibility.
    if not isinstance(row.get("image_urls"), list):
        row["image_urls"] = []

    # Dedupe images by normalized URL and basename, and pick a canonical cover image.
    try:
        row["image_urls"] = dedupe_image_urls(row.get("image_urls") or [])
    except Exception:
        pass
    try:
        cover = pick_cover_image(row.get("image_urls") or [])
        if cover and (
            (not isinstance(row.get("imageurl"), str)) or _is_junk_image_url(row.get("imageurl"))
        ):
            row["imageurl"] = cover
    except Exception:
        pass

    if not row.get("location"):
        row["location"] = _pick_raw(["location", "displayAddress", "display_address"])
    if not row.get("address"):
        row["address"] = _pick_raw(["address", "displayAddress", "display_address", "location"])

    # Prefer a full postcode over an outward-only district whenever scraped
    # address/location/title/url data exposes one. This lets listing cards call
    # the tighter exact/sector comparable endpoints instead of broad outward comps.
    pc = None
    try:
        pc = best_postcode(
            row.get("postcode"),
            row.get("address"),
            row.get("location"),
            row.get("title"),
            row.get("url"),
            _pick_raw(["postcode", "postalCode", "postal_code", "outcode"]),
            _pick_raw(["address", "displayAddress", "display_address", "location"]),
        )
    except Exception:
        pc = None
    if not pc:
        for cand in (row.get("address"), row.get("title"), row.get("url")):
            found = extract_postcode_from_text(str(cand)) if cand else None
            if found:
                pc = best_postcode(None, found)
                break
    if pc:
        row["postcode"] = pc

    # Store outward postcode (district) for downstream scoring/filters.
    if not (isinstance(row.get("postcode_band"), str) and row["postcode_band"].strip()):
        try:
            band = postcode_band(row.get("postcode"))
            if band:
                row["postcode_band"] = band
        except Exception:
            pass

    if row.get("price") in (None, 0, 0.0, ""):
        raw_price = _pick_raw(["price", "displayPrice", "display_price"])
        row["price"] = _coerce_int(raw_price) if raw_price is not None else row.get("price")

    if row.get("bedrooms") in (None, 0, ""):
        raw_beds = _pick_raw(["bedrooms", "beds", "numBedrooms", "numberOfBedrooms"])
        beds = _coerce_int(raw_beds)
        if beds is not None and beds > 0:
            row["bedrooms"] = beds

    if row.get("bathrooms") in (None, 0, ""):
        raw_baths = _pick_raw(["bathrooms", "baths", "numBathrooms", "numberOfBathrooms"])
        baths = _coerce_int(raw_baths)
        if baths is not None and baths > 0:
            row["bathrooms"] = baths

    if row.get("latitude") in (None, 0, 0.0, ""):
        lat = _coerce_float(_pick_raw(["latitude", "lat"]))
        if lat is not None and lat != 0.0:
            row["latitude"] = lat

    if row.get("longitude") in (None, 0, 0.0, ""):
        lng = _coerce_float(_pick_raw(["longitude", "lng", "lon"]))
        if lng is not None and lng != 0.0:
            row["longitude"] = lng

    # DB schema uses `url` (see supabase/schema.sql). Scrapers/normalizers may
    # emit `listing_url` or `raw_url`; map those into `url` and drop the alias
    # to avoid PostgREST "column does not exist" failures.
    source_url = (
        row.get("source_url")
        or row.get("original_listing_url")
        or row.get("url")
        or row.get("listing_url")
        or row.get("raw_url")
    )
    if not row.get("url"):
        row["url"] = source_url
    if source_url:
        row.setdefault("source_url", source_url)
        row.setdefault("original_listing_url", source_url)
    row.pop("listing_url", None)
    row.pop("raw_url", None)

    # Ensure a stable external_id for upsert/dedupe.
    if not row.get("external_id"):
        try:
            row["external_id"] = ensure_external_id(row)
        except Exception:
            pass

    return row


def _strip_field(rows: list[Dict[str, Any]], field: str) -> list[Dict[str, Any]]:
    cleaned: list[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if field in r:
            nr = dict(r)
            nr.pop(field, None)
            cleaned.append(nr)
        else:
            cleaned.append(r)
    return cleaned


def _strip_fields(rows: list[Dict[str, Any]], fields: list[str]) -> list[Dict[str, Any]]:
    cleaned: list[Dict[str, Any]] = []
    to_strip = set(fields or [])
    for r in rows:
        if not isinstance(r, dict):
            continue
        if any(f in r for f in to_strip):
            nr = dict(r)
            for f in to_strip:
                nr.pop(f, None)
            cleaned.append(nr)
        else:
            cleaned.append(r)
    return cleaned


def _upsert_properties_rows(
    *,
    rows: list[Dict[str, Any]],
    on_conflict: str = "source,external_id",
) -> tuple[bool, str | None]:
    """Upsert rows into Supabase with a compatibility retry.

    Production schemas sometimes lag behind code (e.g. missing `last_seen_at`).
    If we detect that specific schema-cache error, retry without the column.
    """
    if not sb:
        return False, "Supabase client not configured (missing SUPABASE_URL/keys)"
    if not rows:
        return False, None

    # Drop empty fields so partial refreshes do not overwrite existing data with nulls/empties.
    prepared: list[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        rr = dict(r)
        if not rr.get("external_id"):
            try:
                rr["external_id"] = ensure_external_id(rr)
            except Exception:
                pass
        cleaned = strip_empty_for_upsert(rr)

        # Deterministic deal score is computed once at ingest/upsert time.
        try:
            score, breakdown = compute_deal_score(cleaned)
            cleaned["score"] = score
            cleaned["score_breakdown"] = breakdown
            cleaned["score_updated_at"] = _now_iso()
        except Exception:
            # Never fail ingestion due to scoring.
            pass

        # Deal signals (investor-first feed): best-effort, additive.
        try:
            extracted = extract_deal_signals(cleaned)
            cleaned["deal_signals"] = (
                extracted.get("signals") if isinstance(extracted, dict) else []
            )
            cleaned["deal_reasons"] = (
                extracted.get("reasons") if isinstance(extracted, dict) else []
            )
            cleaned["discount_estimate_pct"] = (
                extracted.get("discount_estimate_pct") if isinstance(extracted, dict) else None
            )
            lease_years_remaining = (
                extracted.get("lease_years_remaining") if isinstance(extracted, dict) else None
            )
            cleaned["deal_signals_meta"] = (
                {
                    "confidence": extracted.get("confidence"),
                    "matched_terms": extracted.get("matched_terms"),
                }
                if isinstance(extracted, dict)
                else None
            )

            # Always embed lease years into `data` (no migration; stable storage).
            if lease_years_remaining is not None:
                data_obj = cleaned.get("data")
                if not isinstance(data_obj, dict):
                    data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
                data_obj["lease_years_remaining"] = lease_years_remaining
                cleaned["data"] = data_obj
        except Exception:
            # Never fail ingestion due to signals.
            pass

        # Property type classification: deterministic + additive.
        # We always embed into `data` (safe fallback, no migration). If DB columns exist,
        # we also write top-level property_type/raw_property_type.
        try:
            data_obj = cleaned.get("data")
            if not isinstance(data_obj, dict):
                data_obj = {} if data_obj in (None, "") else {"raw": data_obj}

            raw_candidate: Any = (
                cleaned.get("raw_property_type")
                or cleaned.get("property_type")
                or cleaned.get("propertyType")
                or cleaned.get("propertySubType")
                or cleaned.get("property_type_label")
                or cleaned.get("type")
            )
            if not raw_candidate:
                raw_candidate = (
                    data_obj.get("raw_property_type")
                    or data_obj.get("property_type")
                    or data_obj.get("propertyType")
                    or data_obj.get("propertyTypeLabel")
                    or data_obj.get("property_type_label")
                    or data_obj.get("propertySubType")
                    or data_obj.get("type")
                )

            raw_s: str | None = None
            if isinstance(raw_candidate, str) and raw_candidate.strip():
                raw_s = raw_candidate.strip()

            normalized_pt, raw_pt = classify_property_type(
                cleaned.get("title"),
                cleaned.get("description"),
                raw_s,
                extra=data_obj,
            )

            cleaned["property_type"] = normalized_pt
            if raw_pt:
                cleaned["raw_property_type"] = raw_pt

            data_obj["property_type"] = normalized_pt
            if raw_pt:
                data_obj["raw_property_type"] = raw_pt
            cleaned["data"] = data_obj
        except Exception:
            # Never fail ingestion due to property-type classification.
            pass

        # Top Deal Score is a scrape/discovery ranking layer, separate from AI Deal Score.
        try:
            sold_comps = None
            try:
                postcode_for_comps = cleaned.get("postcode")
                if sb and isinstance(postcode_for_comps, str) and postcode_for_comps.strip():
                    sold_comps = get_sold_comps_summary(sb, postcode=postcode_for_comps, limit=20)
            except Exception:
                sold_comps = None
            cleaned = apply_top_deal_ranking(cleaned, sold_comps=sold_comps)
        except Exception:
            # Never fail ingestion due to discovery ranking.
            pass

        prepared.append(cleaned)

    # Final guardrail: never send columns not present in Supabase schema.
    # Keep a small set of useful computed fields by embedding them into `data`.
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

    db_prepared: list[Dict[str, Any]] = []
    for row in prepared:
        if not isinstance(row, dict):
            continue
        from backend.utils.supabase_sanitize import sanitize_property_payload

        db_row = sanitize_property_payload(row, allowed_columns)

        # Preserve deal signals in `data` (stable JSONB column) even when top-level
        # columns don't exist in the DB.
        deal_fields = (
            "deal_signals",
            "deal_reasons",
            "deal_signals_meta",
            "discount_estimate_pct",
        )
        if any(f in row for f in deal_fields):
            data_obj = db_row.get("data")
            if not isinstance(data_obj, dict):
                data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
            for f in deal_fields:
                if f in row:
                    data_obj[f] = row.get(f)
            db_row["data"] = data_obj

        db_prepared.append(db_row)

    prepared = db_prepared

    try:
        sb.table("properties").upsert(prepared, on_conflict=on_conflict).execute()
        return True, None
    except Exception as e:
        msg = str(e)
        if "last_seen_at" in msg and ("PGRST204" in msg or "Could not find" in msg):
            try:
                stripped = _strip_field(prepared, "last_seen_at")
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e2:
                return False, str(e2)

        if "postcode_band" in msg and ("PGRST204" in msg or "Could not find" in msg):
            try:
                stripped = _strip_field(prepared, "postcode_band")
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e2:
                return False, str(e2)

        # Top Deal fields may not exist yet; the full payload is embedded in `data.top_deal`.
        if any(
            f in msg
            for f in ("top_deal_score", "top_deal_tier", "top_deal_reasons", "search_metadata")
        ) and ("PGRST204" in msg or "Could not find" in msg):
            try:
                stripped = _strip_fields(
                    prepared,
                    ["top_deal_score", "top_deal_tier", "top_deal_reasons", "search_metadata"],
                )
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e2b:
                return False, str(e2b)

        # Score fields may not exist yet in some environments / schema cache.
        if ("score" in msg or "score_updated_at" in msg or "score_breakdown" in msg) and (
            "PGRST204" in msg or "Could not find" in msg
        ):
            try:
                stripped = _strip_fields(prepared, ["score", "score_updated_at", "score_breakdown"])
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e3:
                return False, str(e3)

        # Deal signal fields may not exist yet; embed into data JSON as a fallback.
        if ("deal_signals" in msg or "deal_reasons" in msg or "deal_signals_meta" in msg) and (
            "PGRST204" in msg or "Could not find" in msg
        ):
            try:
                stripped = _strip_fields(
                    prepared,
                    [
                        "deal_signals",
                        "deal_reasons",
                        "deal_signals_meta",
                        "discount_estimate_pct",
                    ],
                )

                # Embed the deal fields into `data` to keep them available without a migration.
                embedded: list[Dict[str, Any]] = []
                for original, row in zip(prepared, stripped, strict=False):
                    if not isinstance(row, dict):
                        continue
                    deal_signals = original.get("deal_signals")
                    deal_reasons = original.get("deal_reasons")
                    deal_meta = original.get("deal_signals_meta")
                    discount_est = original.get("discount_estimate_pct")
                    lease_years_remaining = None
                    data_original = original.get("data")
                    if isinstance(data_original, dict):
                        lease_years_remaining = data_original.get("lease_years_remaining")

                    data_obj = row.get("data")
                    if not isinstance(data_obj, dict):
                        data_obj = {} if data_obj in (None, "") else {"raw": data_obj}

                    data_obj["deal_signals"] = deal_signals
                    data_obj["deal_reasons"] = deal_reasons
                    data_obj["deal_signals_meta"] = deal_meta
                    data_obj["discount_estimate_pct"] = discount_est
                    if lease_years_remaining is not None:
                        data_obj["lease_years_remaining"] = lease_years_remaining

                    row["data"] = data_obj
                    embedded.append(row)

                sb.table("properties").upsert(embedded, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e4:
                return False, str(e4)

        # Property type columns may not exist; we already embed into `data`.
        if ("property_type" in msg or "raw_property_type" in msg) and (
            "PGRST204" in msg or "Could not find" in msg
        ):
            try:
                stripped = _strip_fields(prepared, ["property_type", "raw_property_type"])
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e5:
                return False, str(e5)
        return False, msg


def _enqueue_enrichment_for_rows(*, source: str, rows: list[Dict[str, Any]]) -> int:
    """Best-effort: enqueue enrichment jobs for rows just upserted.

    Resolves property UUIDs via (source, external_id) because upsert does not
    reliably return inserted IDs across supabase client versions.
    """

    if not sb:
        return 0

    src = (source or "").strip().lower()
    if not src:
        return 0

    external_ids: list[str] = []
    seen: set[str] = set()
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        eid = r.get("external_id")
        if not isinstance(eid, str) or not eid.strip():
            continue
        e = eid.strip()
        if e not in seen:
            seen.add(e)
            external_ids.append(e)

    if not external_ids:
        return 0

    # Safety cap: keep post-import enqueue bounded.
    external_ids = external_ids[:200]

    property_ids: list[str] = []
    batch_size = 50
    for i in range(0, len(external_ids), batch_size):
        batch = external_ids[i : i + batch_size]
        try:
            res = (
                sb.table("properties")
                .select("id")
                .eq("source", src)
                .in_("external_id", batch)
                .execute()
            )
            data = res.data or []
            if isinstance(data, list):
                for row in data:
                    if (
                        isinstance(row, dict)
                        and isinstance(row.get("id"), str)
                        and row["id"].strip()
                    ):
                        property_ids.append(row["id"].strip())
        except Exception:
            continue

    try:
        res = enqueue_property_ids(property_ids, reason=f"post_import:{src}")
        return int(res.get("enqueued") or 0)
    except Exception:
        # Best-effort fallback: preserve prior behavior.
        for j, pid in enumerate(property_ids):
            try:
                enqueue_job(sb, pid, delay_seconds=j)
            except Exception:
                continue
        return len(property_ids)


def _dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Dedupe across sources by (source, external_id) if available,
    otherwise by (title, price, location).
    """
    seen: set[Tuple[Any, Any, Any]] = set()
    out: List[Dict[str, Any]] = []

    for p in items:
        source = p.get("source")
        ext_id = p.get("external_id")

        if source and ext_id:
            key = ("sid", source, ext_id)
        else:
            key = ("tpl", p.get("title"), p.get("price"), p.get("location"))

        if key in seen:
            continue
        seen.add(key)
        out.append(p)

    return out


def _missing_col_from_api_error(err: Exception) -> str | None:
    payload = err.args[0] if getattr(err, "args", None) else None
    msg = payload.get("message") if isinstance(payload, dict) else str(err)
    if not msg:
        return None
    m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
    if not m:
        return None
    return m.group(1)


def _select_with_existing_cols(build_query, cols: list[str]) -> tuple[Any, list[str]]:
    """Execute a select query, dropping unknown columns if needed."""

    active_cols = list(cols)
    for _ in range(10):
        try:
            select_cols = ",".join(active_cols)
            return build_query(select_cols).execute(), active_cols
        except Exception as e:
            missing = _missing_col_from_api_error(e)
            if not missing:
                raise
            if missing in active_cols and missing != "id":
                active_cols = [c for c in active_cols if c != missing]
                continue
            raise
    raise HTTPException(
        status_code=500,
        detail="Enrichment failed: could not find a compatible column set",
    )


def _image_count(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, list):
        return len([u for u in value if isinstance(u, str) and u.strip()])
    return 0


def _needs_enrichment(row: dict[str, Any]) -> bool:
    img_missing = not (isinstance(row.get("imageurl"), str) and row["imageurl"].strip())
    img_count = _image_count(row.get("image_urls"))
    pc = extract_postcode(row.get("postcode"))
    pc_missing = not (isinstance(pc, str) and pc.strip())
    pc_outward_only = bool(pc and not is_full_postcode(pc))

    def _pos_int(v: Any) -> int:
        try:
            i = int(v)
        except Exception:
            return 0
        return i if i > 0 else 0

    beds_missing = _pos_int(row.get("bedrooms")) <= 0
    baths_missing = _pos_int(row.get("bathrooms")) <= 0
    price_missing = _pos_int(row.get("price")) <= 0

    # Heuristic: allow single-photo records to be enriched (detail pages
    # frequently have full galleries).
    weak_images = img_missing or img_count < 2
    return bool(
        weak_images
        or pc_missing
        or pc_outward_only
        or beds_missing
        or baths_missing
        or price_missing
    )


def _extract_int_from_text(text: str, pattern: str) -> int | None:
    if not text:
        return None
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return None
    try:
        v = int(m.group(1))
        return v if v > 0 else None
    except Exception:
        return None


def _extract_price_from_text(text: str) -> int | None:
    if not text:
        return None
    # Basic GBP formats: £450,000 / £450000 / 450,000
    m = re.search(r"£\s*([0-9][0-9,]{3,})", text)
    if not m:
        m = re.search(r"\b([0-9][0-9,]{3,})\b", text)
    if not m:
        return None
    digits = re.sub(r"[^0-9]", "", m.group(1) or "")
    try:
        v = int(digits)
        return v if v > 0 else None
    except Exception:
        return None


def _extract_images_from_html_attrs(html: str, *, base_url: str) -> list[str]:
    if not html:
        return []

    out: list[str] = []

    # srcset="url1 480w, url2 1024w"
    for m in re.finditer(r"\ssrcset=\"(?P<v>[^\"]+)\"", html, flags=re.IGNORECASE):
        v = (m.group("v") or "").strip()
        if not v:
            continue
        parts = [p.strip() for p in v.split(",") if p.strip()]
        for p in parts:
            url_part = (p.split(" ", 1)[0] or "").strip()
            if url_part:
                out.append(url_part)

    # lazy attrs
    for attr in ("data-src", "data-lazy", "data-original", "data-hi-res-src", "src"):
        for m in re.finditer(
            rf"\s{attr}=\"(?P<u>[^\"]+)\"",
            html,
            flags=re.IGNORECASE,
        ):
            u = (m.group("u") or "").strip()
            if u:
                out.append(u)

    normalized = []
    for u in out:
        nu = normalize_image_url(u, base_url=base_url)
        if nu:
            normalized.append(nu)
    return dedupe_image_urls(normalized, base_url=base_url)


def _merge_data(existing: Any, patch: dict[str, Any]) -> dict[str, Any]:
    base: dict[str, Any] = existing if isinstance(existing, dict) else {}
    out = dict(base)
    enrich = out.get("enrich") if isinstance(out.get("enrich"), dict) else {}
    enrich2 = dict(enrich)
    enrich2.update(patch)
    out["enrich"] = enrich2
    return out


async def _enrich_rows_best_effort(*, rows: list[dict[str, Any]], max_items: int) -> None:
    """Best-effort enrichment for a bounded list of freshly ingested rows.

    Writes improvements back via upsert on (source,external_id) to avoid requiring
    DB primary keys.
    """

    try:
        if not sb:
            return
        if not rows:
            return

        max_items = max(1, min(int(max_items or 0), len(rows)))
        headers = {
            "User-Agent": os.getenv(
                "SCRAPER_USER_AGENT",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )
        }

        sem = asyncio.Semaphore(max(1, min(5, int(os.getenv("ENRICH_CONCURRENCY", "3")))))

        async with aiohttp.ClientSession() as session:
            patches: list[dict[str, Any]] = []

            async def _one(r: dict[str, Any]) -> None:
                if not isinstance(r, dict):
                    return
                if not _needs_enrichment(r):
                    return

                url = r.get("url")
                if not isinstance(url, str) or not url.strip():
                    return
                url = url.strip()
                try:
                    if (urlparse(url).scheme or "").lower() not in ("http", "https"):
                        return
                except Exception:
                    return

                async with sem:
                    try:
                        _status, html, _diag = await fetch_detail_html_with_diag(
                            session,
                            url,
                            headers=headers,
                            timeout=75,
                            country_code=os.getenv("SCRAPERAPI_COUNTRY_CODE", "gb"),
                            prefer_render=True,
                            prefer_premium=True,
                            max_retries=2,
                        )
                    except Exception:
                        return

                if not html or not isinstance(html, str) or not html.strip():
                    return

                imgs_ld = extract_image_urls_from_ld_json(html, base_url=url)
                nd = extract_next_data_json(html)
                imgs_next = extract_image_urls_from_next_data(nd, base_url=url) if nd else []
                imgs_attr = _extract_images_from_html_attrs(html, base_url=url)
                imgs = dedupe_image_urls([*imgs_ld, *imgs_next, *imgs_attr], base_url=url)

                existing_imgs = r.get("image_urls") if isinstance(r.get("image_urls"), list) else []
                merged_imgs = dedupe_image_urls([*imgs, *existing_imgs], base_url=url)
                cover = pick_cover_image(merged_imgs) if merged_imgs else None

                pc = best_postcode(
                    r.get("postcode"),
                    r.get("address"),
                    r.get("location"),
                    r.get("title"),
                    html,
                )

                beds = _extract_int_from_text(html, r"\b(\d+)\s*(?:bed|bedroom)s?\b")
                baths = _extract_int_from_text(html, r"\b(\d+)\s*(?:bath|bathroom)s?\b")
                price = _extract_price_from_text(html)

                patch: dict[str, Any] = {
                    "source": r.get("source"),
                    "external_id": r.get("external_id"),
                    "url": r.get("url"),
                }

                if merged_imgs and _image_count(existing_imgs) < max(2, len(merged_imgs)):
                    patch["image_urls"] = merged_imgs
                if cover and not (
                    isinstance(r.get("imageurl"), str) and str(r.get("imageurl")).strip()
                ):
                    patch["imageurl"] = cover
                if pc and best_postcode(r.get("postcode")) != pc:
                    patch["postcode"] = pc
                if beds and int(r.get("bedrooms") or 0) <= 0:
                    patch["bedrooms"] = beds
                if baths and int(r.get("bathrooms") or 0) <= 0:
                    patch["bathrooms"] = baths
                if price and int(r.get("price") or 0) <= 0:
                    patch["price"] = price

                patch = strip_empty_for_upsert(patch)
                if len(patch.keys()) > 3:
                    patches.append(patch)

            await asyncio.gather(*[_one(r) for r in rows[:max_items] if isinstance(r, dict)])

        if patches:
            _upsert_properties_rows(rows=patches, on_conflict="source,external_id")
    except Exception:
        return


def _scrape_zero_warning(location: str, sources: Dict[str, int] | None = None) -> str | None:
    """Return a human-readable warning when scrapers return 0 results.

    This is intentionally heuristic: production datacenter IPs are often blocked by
    listing sites. If no proxy (ScraperAPI) and no browser rendering is enabled,
    returning 0 with no explanation is confusing.
    """

    loc = (location or "").strip()
    if not loc:
        return None

    # Only warn if everything is 0 (or unknown)
    if sources and any(v > 0 for v in sources.values()):
        return None

    scraper_mode = (os.getenv("SCRAPER_MODE") or "direct").strip().lower()
    has_scraperapi = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())
    playwright_enabled = (os.getenv("PLAYWRIGHT_ENABLE") or "0") == "1"

    if has_scraperapi:
        # Even with ScraperAPI configured, some locations can legitimately yield 0.
        return None

    # No ScraperAPI key. If Playwright is also off, the most likely reason is blocking.
    if (scraper_mode in ("direct", "smart")) and not playwright_enabled:
        return (
            "Scrape returned 0. Likely blocked from this network (common on Railway/VPS IPs). "
            "Set SCRAPERAPI_KEY and use SCRAPER_MODE=scraperapi (or smart), "
            "or enable PLAYWRIGHT_ENABLE=1 with Playwright browsers installed."
        )

    return None


@router.post("/all")
async def import_all(
    request: Request,
    req: str | None = Query(None, description="Location e.g. London"),
    enrich: bool = Query(
        False,
        description="If true, queue bounded detail-page enrichment after import",
    ),
    enrich_limit: int = Query(
        8,
        ge=1,
        le=50,
        description="Max number of newly imported rows to enrich",
    ),
    x_admin_token: str | None = Header(None),
):
    require_admin(request)

    # Prefer query param
    loc = (req or "").strip()

    if not loc:
        raise HTTPException(
            status_code=422,
            detail="Missing location. Use ?req=London or JSON body {'location':'London'}",
        )

    run_id = create_scrape_run(source="all", location=loc)

    # ✅ Run scrapers
    items = await _maybe_await(scrape_all_sources(loc))
    if not isinstance(items, list):
        items = []

    sources: Dict[str, int] = {
        "rightmove": 0,
        "zoopla": 0,
        "onthemarket": 0,
    }
    for p in items:
        if isinstance(p, dict):
            src = str(p.get("source") or "").strip()
            if src in sources:
                sources[src] += 1

    # ✅ Add last_seen_at, remove non-db fields
    now_iso = datetime.now(timezone.utc).isoformat()
    db_rows = []
    for p in items:
        if not isinstance(p, dict):
            continue
        db_rows.append(_clean_row(p, now_iso))

    # Best-effort postcode geocoding for map pins
    await _fill_missing_coords_from_postcode(db_rows)

    # ✅ Upsert into Supabase
    inserted = 0
    if sb and db_rows:
        ok, err = _upsert_properties_rows(rows=db_rows, on_conflict="source,external_id")
        if ok:
            inserted = len(db_rows)
            # Auto-enqueue enrichment jobs (best-effort; never fail import).
            try:
                ids = [
                    str(r.get("id")).strip()
                    for r in db_rows
                    if isinstance(r, dict)
                    and isinstance(r.get("id"), str)
                    and str(r.get("id") or "").strip()
                ]
                enq = 0
                if ids:
                    enq = int(
                        enqueue_property_ids(ids, reason="post_import:all").get("enqueued") or 0
                    )
                else:
                    by_source: dict[str, list[dict[str, Any]]] = {}
                    for r in db_rows:
                        if not isinstance(r, dict):
                            continue
                        src = str(r.get("source") or "").strip().lower()
                        if not src:
                            continue
                        by_source.setdefault(src, []).append(r)
                    for src, src_rows in by_source.items():
                        enq += _enqueue_enrichment_for_rows(source=src, rows=src_rows)

                if enq:
                    logging.info(
                        "enrich_auto_enqueue route=import_all reason=post_import:all enqueued=%s",
                        enq,
                    )
            except Exception:
                pass
        else:
            finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=str(err))
            raise HTTPException(status_code=500, detail=f"DB upsert failed: {err}")

    finish_scrape_run(run_id=run_id, status="success", count_inserted=inserted)

    if inserted == 0:
        logging.info("Import completed with 0 properties for location=%s", loc)

    warning = _scrape_zero_warning(loc, sources=sources)
    # Optional: queue stage-2 enrichment for the just-imported rows.
    enrich_queued = False
    if enrich and inserted > 0:
        max_items = max(1, min(int(enrich_limit or 0), inserted))

        asyncio.create_task(_enrich_rows_best_effort(rows=db_rows, max_items=max_items))
        enrich_queued = True

    payload = {
        "location": loc,
        "total_imported": inserted,
        "sources": sources,
    }
    if enrich:
        payload["enrich_queued"] = enrich_queued
        payload["enrich_limit"] = int(enrich_limit)
    if warning:
        payload["warning"] = warning
    return payload


# ---------------- existing endpoints kept as-is ----------------


class ImportRequest(BaseModel):
    location: str


class BatchImportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    cities: List[str] | None = Field(
        default=None,
        validation_alias=AliasChoices("cities", "locations"),
        description="List of cities/locations to import (accepts 'cities' or legacy 'locations')",
    )
    sources: List[str] | None = Field(
        default=None,
        description="Optional source filter (e.g. ['onthemarket']). Defaults to all supported sources.",
    )
    max_pages: int = 1
    delay_min_s: float = 0.5
    delay_max_s: float = 1.5
    run_async: bool = True
    # Must exceed upstream scraper timeouts (SCRAPER_TIMEOUT_SECONDS/INGEST_TIMEOUT_SECONDS)
    # otherwise the batch runner will time out cities before sources finish.
    per_city_timeout_s: float = 210.0


def _get_scrape_timeout_seconds() -> float:
    """Best-effort: read the configured scraper timeout (seconds)."""

    for k in ("INGEST_TIMEOUT_SECONDS", "SCRAPER_TIMEOUT_SECONDS"):
        v = (os.getenv(k) or "").strip()
        if not v:
            continue
        try:
            f = float(v)
            if f > 0:
                return f
        except Exception:
            continue
    return 20.0


@router.post("/zoopla")
async def import_zoopla(
    request: Request,
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    # Optionally protect import endpoints in production.
    # If IMPORT_ADMIN_TOKEN is unset, this is a no-op.
    require_admin(request)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="zoopla", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_zoopla_properties(loc, max_pages=max_pages),
                run_id=run_id,
                source="zoopla",
            )
            return {"queued": True, "source": "zoopla", "location": loc}

        items = await _maybe_await(scrape_zoopla_properties(loc, max_pages=max_pages))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    enqueued = 0
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        await _fill_missing_coords_from_postcode(db_rows)
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)
        if db_upsert_ok:
            enqueued = _enqueue_enrichment_for_rows(source="zoopla", rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if enqueued:
        payload["enrich_enqueued"] = enqueued
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"zoopla": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.get("/zoopla")
async def import_zoopla_get(
    request: Request,
    location: str = Query(..., description="Location to scrape"),
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    # Keep backwards compatibility with operational curl usage:
    # `GET /import/zoopla?location=London`
    return await import_zoopla(
        request,
        ImportRequest(location=location),
        x_admin_token=x_admin_token,
        run_async=run_async,
        max_pages=max_pages,
    )


@router.post("/rightmove")
async def import_rightmove(
    request: Request,
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
):
    require_admin(request)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="rightmove", location=loc)
    try:
        from backend.scraper.rightmove_scraper import scrape_rightmove_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_rightmove_properties(loc),
                run_id=run_id,
                source="rightmove",
            )
            return {"queued": True, "source": "rightmove", "location": loc}

        items = await _maybe_await(scrape_rightmove_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    enqueued = 0
    if not sb:
        db_error = "Supabase client not configured (missing SUPABASE_URL/keys)"
    elif items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            await _fill_missing_coords_from_postcode(db_rows)
            db_upsert_ok, db_error = _upsert_properties_rows(
                rows=db_rows,
                on_conflict="source,external_id",
            )
            if db_upsert_ok:
                enqueued = _enqueue_enrichment_for_rows(source="rightmove", rows=db_rows)
        except Exception as e:
            db_error = str(e)

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if enqueued:
        payload["enrich_enqueued"] = enqueued
    if db_error:
        payload["db_error"] = db_error

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if db_error else "success",
            count_inserted=0 if db_error else len(items),
            error=db_error,
        )
    warning = _scrape_zero_warning(loc, sources={"rightmove": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/onthemarket")
async def import_onthemarket(
    request: Request,
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    require_admin(request)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="onthemarket", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.onthemarket_scraper import (
            scrape_onthemarket_properties,  # type: ignore
        )

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_onthemarket_properties(loc, max_pages=max_pages),
                run_id=run_id,
                source="onthemarket",
            )
            return {"queued": True, "source": "onthemarket", "location": loc}

        items = await _maybe_await(scrape_onthemarket_properties(loc, max_pages=max_pages))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    enqueued = 0
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        await _fill_missing_coords_from_postcode(db_rows)
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)
        if db_upsert_ok:
            enqueued = _enqueue_enrichment_for_rows(source="onthemarket", rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if enqueued:
        payload["enrich_enqueued"] = enqueued
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"onthemarket": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/batch")
async def import_batch(
    request: Request,
    req: BatchImportRequest,
    enrich: bool = Query(
        False,
        description="If true, queue bounded detail-page enrichment per city after import",
    ),
    enrich_limit: int = Query(
        5,
        ge=1,
        le=50,
        description="Max number of newly imported rows to enrich per city",
    ),
    x_admin_token: str | None = Header(None),
):
    """Batch import across multiple UK cities.

    This is intentionally sequential with small delays to reduce rate-limit risk.
    """

    require_admin(request)

    max_pages = max(1, min(5, int(req.max_pages or 1)))
    delay_min = max(0.0, float(req.delay_min_s))
    delay_max = max(delay_min, float(req.delay_max_s))

    raw_cities = req.cities if req.cities else TARGET_CITIES
    cities: List[str] = []
    seen = set()
    for c in raw_cities:
        s = (c or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        cities.append(s)

    if not cities:
        raise HTTPException(status_code=400, detail="No cities provided")

    # Safety cap: keep the endpoint bounded.
    cities = cities[:25]

    # Ensure the batch wrapper timeout is never lower than the underlying scraper timeout.
    # Otherwise, every city can fail with "timeout after Xs" even when scrapers are healthy.
    per_city_timeout_s = float(req.per_city_timeout_s or 0)
    per_city_timeout_s = max(per_city_timeout_s, _get_scrape_timeout_seconds() + 30.0, 60.0)

    allowed_sources = ("rightmove", "zoopla", "onthemarket")
    if req.sources:
        requested_sources: List[str] = []
        seen_src: set[str] = set()
        for s in req.sources:
            key = (s or "").strip().lower()
            if not key:
                continue
            if key not in allowed_sources:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid source '{s}'. Allowed: {list(allowed_sources)}",
                )
            if key in seen_src:
                continue
            seen_src.add(key)
            requested_sources.append(key)
        if not requested_sources:
            raise HTTPException(status_code=400, detail="No valid sources provided")
    else:
        requested_sources = list(allowed_sources)

    if req.run_async:
        if not sb:
            raise HTTPException(
                status_code=500,
                detail="Async batch requires Supabase (SUPABASE_URL/keys) for durable status",
            )
        batch_id = _create_durable_batch_run(cities=cities)
        request_payload = {
            "cities": cities,
            "sources": requested_sources,
            "max_pages": max_pages,
            "delay_min_s": delay_min,
            "delay_max_s": delay_max,
            "per_city_timeout_s": float(per_city_timeout_s or 0),
            "enrich": bool(enrich),
            "enrich_limit": int(enrich_limit),
        }

        initial_snap: dict[str, Any] = {
            "batch_id": batch_id,
            "status": "queued",
            "request": request_payload,
            "cities": cities,
            "sources": requested_sources,
            "max_pages": max_pages,
            "delay_min_s": delay_min,
            "delay_max_s": delay_max,
            "total_scraped": 0,
            "total_imported": 0,
            "per_city": {
                c: {
                    "scraped": 0,
                    "imported": 0,
                    "status": "queued",
                    "sources": {
                        s: {
                            "status": "queued",
                            "scraped": 0,
                            "imported": 0,
                            "error": None,
                        }
                        for s in requested_sources
                    },
                }
                for c in cities
            },
        }

        await _persist_batch_snapshot(batch_id, initial_snap, status="queued")

        _queue_batch_job(
            batch_id=batch_id,
            cities=cities,
            sources=requested_sources,
            max_pages=max_pages,
            delay_min_s=delay_min,
            delay_max_s=delay_max,
            per_city_timeout_s=per_city_timeout_s,
            enrich=bool(enrich),
            enrich_limit=int(enrich_limit),
            initial_snapshot=initial_snap,
        )

        return {
            "queued": True,
            "batch_id": batch_id,
            "status_url": f"/import/batch/status/{batch_id}",
            "enrich": bool(enrich),
            "enrich_limit": int(enrich_limit),
        }

    run_id = create_scrape_run(source="batch", location=f"{len(cities)} cities")

    total_items = 0
    total_inserted = 0
    per_city: Dict[str, Dict[str, Any]] = {}
    scrape_error: str | None = None
    db_error: str | None = None

    try:
        for i, city in enumerate(cities):
            items = await _maybe_await(
                scrape_all_sources(
                    city,
                    sources=requested_sources,
                    zoopla_max_pages=max_pages,
                    onthemarket_max_pages=max_pages,
                )
            )
            if not isinstance(items, list):
                items = []

            total_items += len(items)
            inserted = 0
            if items:
                now_iso = _now_iso()
                db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
                await _fill_missing_coords_from_postcode(db_rows)
                ok, e = _upsert_properties_rows(rows=db_rows)
                if ok:
                    inserted = len(db_rows)
                    total_inserted += inserted
                    # Auto-enqueue enrichment jobs (best-effort; never fail import).
                    try:
                        ids = [
                            str(r.get("id")).strip()
                            for r in db_rows
                            if isinstance(r, dict)
                            and isinstance(r.get("id"), str)
                            and str(r.get("id") or "").strip()
                        ]
                        enq = 0
                        if ids:
                            enq = int(
                                enqueue_property_ids(ids, reason="post_import:batch").get(
                                    "enqueued"
                                )
                                or 0
                            )
                        else:
                            by_source: dict[str, list[dict[str, Any]]] = {}
                            for r in db_rows:
                                if not isinstance(r, dict):
                                    continue
                                src = str(r.get("source") or "").strip().lower()
                                if not src:
                                    continue
                                by_source.setdefault(src, []).append(r)
                            for src, src_rows in by_source.items():
                                enq += _enqueue_enrichment_for_rows(source=src, rows=src_rows)

                        if enq:
                            logging.info(
                                "enrich_auto_enqueue route=import_batch reason=post_import:batch city=%s enqueued=%s",
                                city,
                                enq,
                            )
                    except Exception:
                        pass
                    if enrich and inserted > 0:
                        asyncio.create_task(
                            _enrich_rows_best_effort(rows=db_rows, max_items=int(enrich_limit))
                        )
                else:
                    db_error = e

            per_city[city] = {
                "count": len(items),
                "inserted": inserted,
            }

            if i < len(cities) - 1:
                await asyncio.sleep(random.uniform(delay_min, delay_max))

    except Exception as e:
        scrape_error = str(e)

    if db_error:
        finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=db_error)
    elif scrape_error:
        finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=scrape_error)
    else:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=total_inserted)

    payload: Dict[str, Any] = {
        "cities": cities,
        "max_pages": max_pages,
        "total_scraped": total_items,
        "total_imported": total_inserted,
        "per_city": per_city,
        "enrich": bool(enrich),
        "enrich_limit": int(enrich_limit),
    }
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    return payload


@router.post("/enrich-missing")
async def enrich_missing_properties(
    request: Request,
    limit: int = Query(20, ge=1, le=200, description="Max rows to enrich"),
    scan_limit: int = Query(
        400,
        ge=50,
        le=5000,
        description="How many recent rows to scan for missing fields",
    ),
    dry_run: bool = Query(False, description="If true, do not write updates"),
    x_admin_token: str | None = Header(None),
):
    """Stage-2 enrichment runner.

    Scans recent properties for missing/weak fields and refetches detail pages to
    backfill: gallery images, postcode, bedrooms, bathrooms, and price.

    This is best-effort and safe to rerun; it only writes non-empty improvements.
    """

    require_admin(request)
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase client not configured")

    cols = [
        "id",
        "source",
        "url",
        "title",
        "location",
        "address",
        "description",
        "imageurl",
        "image_urls",
        "postcode",
        "bedrooms",
        "bathrooms",
        "price",
        "data",
        "created_at",
    ]

    def _query(select_cols: str):
        q = sb.table("properties").select(select_cols).limit(int(scan_limit))
        # Prefer recency ordering when available.
        if "created_at" in cols:
            try:
                q = q.order("created_at", desc=True)
            except Exception:
                pass
        return q

    try:
        res, active_cols = _select_with_existing_cols(_query, cols)
    except APIError as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

    rows = getattr(res, "data", None) or []
    if not isinstance(rows, list):
        rows = []

    candidates: list[dict[str, Any]] = [r for r in rows if isinstance(r, dict) and r.get("id")]
    candidates = [r for r in candidates if _needs_enrichment(r)]

    attempted = 0
    enriched = 0
    skipped = 0
    failures: list[dict[str, Any]] = []
    updated_ids: list[str] = []

    headers = {
        "User-Agent": os.getenv(
            "SCRAPER_USER_AGENT",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        )
    }

    async with aiohttp.ClientSession() as session:
        for row in candidates[: int(limit)]:
            attempted += 1
            pid = row.get("id")
            url = row.get("url")
            if not isinstance(url, str) or not url.strip():
                skipped += 1
                continue
            url = url.strip()

            # Basic URL sanity
            try:
                if (urlparse(url).scheme or "").lower() not in ("http", "https"):
                    skipped += 1
                    continue
            except Exception:
                skipped += 1
                continue

            try:
                status, html, diag = await fetch_detail_html_with_diag(
                    session,
                    url,
                    headers=headers,
                    timeout=75,
                    country_code=os.getenv("SCRAPERAPI_COUNTRY_CODE", "gb"),
                    prefer_render=True,
                    prefer_premium=True,
                    max_retries=2,
                )
            except Exception as e:
                failures.append({"id": pid, "url": url, "error": str(e)})
                continue

            if not html or not isinstance(html, str) or not html.strip():
                failures.append(
                    {
                        "id": pid,
                        "url": url,
                        "status": status,
                        "error": "empty_html",
                        "via": (diag or {}).get("via") if isinstance(diag, dict) else None,
                    }
                )
                continue

            # Extract images
            imgs_ld = extract_image_urls_from_ld_json(html, base_url=url)
            nd = extract_next_data_json(html)
            imgs_next = extract_image_urls_from_next_data(nd, base_url=url) if nd else []
            imgs_attr = _extract_images_from_html_attrs(html, base_url=url)
            imgs = dedupe_image_urls([*imgs_ld, *imgs_next, *imgs_attr], base_url=url)

            # Merge with existing gallery (don’t lose previous good data)
            existing_imgs = row.get("image_urls") if isinstance(row.get("image_urls"), list) else []
            merged_imgs = dedupe_image_urls([*imgs, *existing_imgs], base_url=url)
            cover = pick_cover_image(merged_imgs) if merged_imgs else None

            # Extract postcode
            pc = best_postcode(
                row.get("postcode"),
                row.get("address"),
                row.get("location"),
                row.get("title"),
                html,
            )

            # Extract beds/baths/price (very conservative)
            beds = _extract_int_from_text(html, r"\b(\d+)\s*(?:bed|bedroom)s?\b")
            baths = _extract_int_from_text(html, r"\b(\d+)\s*(?:bath|bathroom)s?\b")
            price = _extract_price_from_text(html)

            payload: dict[str, Any] = {"id": pid}
            # Only fill missing/weak fields; avoid overwriting strong existing values.
            if merged_imgs and _image_count(row.get("image_urls")) < max(2, len(merged_imgs)):
                payload["image_urls"] = merged_imgs
            if cover and not (isinstance(row.get("imageurl"), str) and row["imageurl"].strip()):
                payload["imageurl"] = cover
            if pc and best_postcode(row.get("postcode")) != pc:
                payload["postcode"] = pc
            if beds and int(row.get("bedrooms") or 0) <= 0:
                payload["bedrooms"] = beds
            if baths and int(row.get("bathrooms") or 0) <= 0:
                payload["bathrooms"] = baths
            if price and int(row.get("price") or 0) <= 0:
                payload["price"] = price

            # Record enrichment diagnostics (best-effort; may be dropped if `data` column missing)
            if "data" in active_cols and isinstance(diag, dict):
                payload["data"] = _merge_data(
                    row.get("data"),
                    {
                        "attempted_at": _now_iso(),
                        "detail_url": url,
                        "status": status,
                        "via": diag.get("via"),
                        "block_reason": diag.get("block_reason"),
                        "bytes": diag.get("bytes"),
                    },
                )

            # Compute and store score if we have at least one meaningful change.
            stripped = strip_empty_for_upsert(payload)
            # Keep `id` for update even though strip_empty may drop it.
            stripped["id"] = pid

            if len(stripped.keys()) <= 1:
                skipped += 1
                continue

            # Best-effort: compute a refreshed score based on merged row.
            merged_for_score = dict(row)
            merged_for_score.update(stripped)
            try:
                score, breakdown = compute_deal_score(merged_for_score)
                stripped["score"] = score
                stripped["score_breakdown"] = breakdown
                stripped["score_updated_at"] = _now_iso()
            except Exception:
                pass

            if dry_run:
                enriched += 1
                updated_ids.append(str(pid))
                continue

            # Apply update; retry if optional columns are missing in older schemas.
            try:
                sb.table("properties").update(stripped).eq("id", str(pid)).execute()
                enriched += 1
                updated_ids.append(str(pid))
            except Exception as e:
                msg = str(e)
                retry_payload = dict(stripped)
                # Drop optional columns when schema cache lags.
                for optional_col in ("data", "score", "score_breakdown", "score_updated_at"):
                    if optional_col in msg and ("PGRST204" in msg or "Could not find" in msg):
                        retry_payload.pop(optional_col, None)
                try:
                    sb.table("properties").update(retry_payload).eq("id", str(pid)).execute()
                    enriched += 1
                    updated_ids.append(str(pid))
                except Exception as e2:
                    failures.append({"id": pid, "url": url, "error": str(e2)})

    return {
        "scan_limit": int(scan_limit),
        "candidate_count": len(candidates),
        "attempted": attempted,
        "enriched": enriched,
        "skipped": skipped,
        "dry_run": bool(dry_run),
        "updated_ids": updated_ids,
        "failures": failures[:50],
    }


@router.post("/spareroom")
async def import_spareroom(
    request: Request,
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
):
    require_admin(request)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="spareroom", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.spare_room_scraper import scrape_spareroom_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_spareroom_properties(loc),
                run_id=run_id,
                source="spareroom",
            )
            return {"queued": True, "source": "spareroom", "location": loc}

        items = await _maybe_await(scrape_spareroom_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        await _fill_missing_coords_from_postcode(db_rows)
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"spareroom": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.get("/batch/status/{batch_id}")
async def import_batch_status(
    request: Request,
    batch_id: str,
    x_admin_token: str | None = Header(None),
):
    require_admin(request)

    if not sb:
        raise HTTPException(
            status_code=500,
            detail="Supabase client not configured; async batch status is DB-backed only",
        )

    try:
        res = (
            sb.table("scrape_runs")
            .select("id,status,count_inserted,error,data")
            .eq("id", batch_id)
            .execute()
        )
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

    rows = getattr(res, "data", None) or []
    if not (isinstance(rows, list) and rows and isinstance(rows[0], dict)):
        raise HTTPException(status_code=404, detail="batch_id not found")

    row = rows[0]
    snap = row.get("data") if isinstance(row.get("data"), dict) else {}
    out: dict[str, Any] = {**snap} if isinstance(snap, dict) else {}
    out["batch_id"] = batch_id
    out["status"] = row.get("status") or out.get("status") or "unknown"
    out["total_imported"] = int(row.get("count_inserted") or out.get("total_imported") or 0)
    if row.get("error"):
        out["error"] = row.get("error")
    out["durable"] = True
    return out


# ---------------- backwards-compatible alias ----------------


_import_router = router
router = admin_alias_router


@router.post("/admin/import-all")
async def admin_import_all(
    request: Request,
    req: str,
    x_admin_token: str | None = Header(None),
):
    return await import_all(req=req, x_admin_token=x_admin_token, request=request)


router = _import_router
