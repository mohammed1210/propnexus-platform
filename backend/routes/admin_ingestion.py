from __future__ import annotations

import asyncio
import inspect
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.scripts.backfill_top_deals import backfill_top_deals
from backend.tasks.ingestion_runner import _ingest_location, get_ingestion_status_snapshot
from backend.utils.admin_auth import require_admin
from backend.utils.supabase_client import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


class RunIngestionBody(BaseModel):
    location: str
    mode: Optional[str] = "direct"
    limit: Optional[int] = None
    sources: Optional[list[str]] = None


class BackfillTopDealsBody(BaseModel):
    limit: Optional[int] = 100
    batch_size: Optional[int] = 100
    dry_run: bool = True
    force: bool = False
    source: Optional[str] = None


def _parse_dt(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@router.post("/admin/run-ingestion", status_code=202)
async def admin_run_ingestion(request: Request, body: RunIngestionBody):
    """Trigger one ingestion cycle asynchronously.

    Returns immediately with 202 to avoid blocking the request.
    """

    require_admin(request)

    started_at = time.time()

    location = (body.location or "").strip()
    if not location:
        # Keep behavior consistent with FastAPI validation semantics.
        # (Empty string is technically valid for pydantic unless constrained.)
        raise ValueError("location is required")

    mode = (body.mode or "direct").strip() or "direct"
    limit = body.limit
    sources = [s.strip().lower() for s in (body.sources or []) if s.strip()] or None

    async def _runner() -> None:
        try:
            prev_mode = os.environ.get("SCRAPER_MODE")
            try:
                os.environ["SCRAPER_MODE"] = mode

                sig = inspect.signature(_ingest_location)
                kwargs: dict[str, object] = {}
                if "mode" in sig.parameters:
                    kwargs["mode"] = mode
                if "limit" in sig.parameters:
                    kwargs["limit"] = limit
                if "sources" in sig.parameters:
                    kwargs["sources"] = sources

                total = await _ingest_location(location, **kwargs)
            finally:
                if prev_mode is None:
                    os.environ.pop("SCRAPER_MODE", None)
                else:
                    os.environ["SCRAPER_MODE"] = prev_mode
            dur_ms = (time.time() - started_at) * 1000
            logger.info("[admin][ingest] complete total=%s dur_ms=%.0f", total, dur_ms)
        except Exception:
            logger.exception("[admin][ingest] failed")

    task = asyncio.create_task(_runner())

    def _done_callback(t: asyncio.Task) -> None:
        try:
            exc = t.exception()
            if exc is not None:
                logger.exception("[admin][ingest] task crashed", exc_info=exc)
        except Exception:
            logger.exception("[admin][ingest] task callback failed")

    task.add_done_callback(_done_callback)
    return {
        "ok": True,
        "status": "queued",
        "location": location,
        "mode": mode,
        "sources": sources,
        **({"limit": limit} if limit is not None else {}),
    }


@router.get("/admin/ingestion/status")
def admin_ingestion_status(request: Request):
    require_admin(request)
    snapshot = get_ingestion_status_snapshot()
    sb = get_supabase(required=False)
    recent_runs = []
    if sb:
        try:
            res = (
                sb.table("scrape_runs")
                .select(
                    "source,location,status,count_inserted,error,started_at,finished_at,created_at"
                )
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            recent_runs = list(getattr(res, "data", []) or [])
        except Exception as e:
            snapshot["last_error"] = f"scrape_runs unavailable: {e}"

    latest = recent_runs[0] if recent_runs else None
    status = "healthy"
    latest_ts = _parse_dt((latest or {}).get("finished_at") or (latest or {}).get("created_at"))
    stale_after = timedelta(seconds=max(1800, int(os.getenv("INGEST_STALE_SECONDS", "3600"))))
    if snapshot.get("last_error") or (
        latest and str(latest.get("status") or "").lower() in {"error", "failed"}
    ):
        status = "degraded"
    elif latest_ts and datetime.now(timezone.utc) - latest_ts > stale_after:
        status = "stale"
    elif not latest and not snapshot.get("last_finished_at"):
        status = "stale"

    return {
        "ok": True,
        "status": status,
        "runner": snapshot,
        "latest_scrape_runs": recent_runs,
        "latest_run": latest,
    }


@router.post("/admin/backfill/top-deals")
def admin_backfill_top_deals(request: Request, body: BackfillTopDealsBody):
    require_admin(request)
    sb = get_supabase(required=True)
    summary = backfill_top_deals(
        sb,
        limit=body.limit if body.limit and body.limit > 0 else None,
        batch_size=max(1, int(body.batch_size or 100)),
        dry_run=body.dry_run,
        force=body.force,
        source=body.source,
    )
    return {"ok": True, "summary": summary}
