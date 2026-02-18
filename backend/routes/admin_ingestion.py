from __future__ import annotations

import asyncio
import logging
import os
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.tasks.ingestion_runner import _ingest_location, run_cycle
from backend.utils.admin_auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


class IngestionRequest(BaseModel):
    location: str | None = None
    mode: str | None = None
    limit: int | None = None


@router.post("/admin/run-ingestion", status_code=202)
async def admin_run_ingestion(request: Request, payload: IngestionRequest | None = None):
    """Trigger one ingestion cycle asynchronously.

    Returns immediately with 202 to avoid blocking the request.
    """

    require_admin(request)

    started_at = time.time()

    async def _runner() -> None:
        try:
            loc = payload.location if payload else None
            mode = payload.mode if payload else None
            limit = payload.limit if payload else None

            prev_mode = os.environ.get("SCRAPER_MODE")
            try:
                if mode and isinstance(mode, str) and mode.strip():
                    os.environ["SCRAPER_MODE"] = mode.strip()

                if loc and isinstance(loc, str) and loc.strip():
                    total = await _ingest_location(loc.strip(), limit=limit)
                else:
                    total = await run_cycle()
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
        **(
            {
                "location": payload.location,
                **({"limit": payload.limit} if payload and payload.limit is not None else {}),
            }
            if payload and payload.location
            else {}
        ),
    }
