from __future__ import annotations

import asyncio
import inspect
import logging
import os
import time
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.tasks.ingestion_runner import _ingest_location
from backend.utils.admin_auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


class RunIngestionBody(BaseModel):
    location: str
    mode: Optional[str] = "scraperapi"
    limit: Optional[int] = None


@router.post("/admin/run-ingestion", status_code=202)
async def run_ingestion(body: RunIngestionBody, request: Request):
    """Trigger one ingestion cycle asynchronously.

    Returns immediately with 202 to avoid blocking the request.
    """

    require_admin(request)

    started_at = time.time()

    location = body.location.strip()
    if not location:
        # Keep behavior consistent with FastAPI validation semantics.
        # (Empty string is technically valid for pydantic unless constrained.)
        raise ValueError("location is required")

    mode = (body.mode or "scraperapi").strip() or "scraperapi"
    limit = body.limit

    async def _runner() -> None:
        total = 0
        try:
            prev_mode = os.environ.get("SCRAPER_MODE")
            try:
                os.environ["SCRAPER_MODE"] = mode

                sig = inspect.signature(_ingest_location)
                kwargs: dict[str, object] = {}
                if "mode" in sig.parameters:
                    kwargs["mode"] = mode
                if "limit" in sig.parameters and limit is not None:
                    kwargs["limit"] = limit

                total = await _ingest_location(location, **kwargs)
            finally:
                if prev_mode is None:
                    os.environ.pop("SCRAPER_MODE", None)
                else:
                    os.environ["SCRAPER_MODE"] = prev_mode
        except Exception as e:
            logger.exception("[admin][ingest] failed for location=%s: %s", location, e)
            total = 0
        dur_ms = (time.time() - started_at) * 1000
        logger.info("[admin][ingest] complete total=%s dur_ms=%.0f", total, dur_ms)

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
        **({"limit": limit} if limit is not None else {}),
    }
