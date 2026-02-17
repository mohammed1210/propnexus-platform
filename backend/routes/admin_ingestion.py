from __future__ import annotations

import asyncio
import logging
import os
import time

from fastapi import APIRouter, Header, HTTPException

from backend.tasks.ingestion_runner import run_cycle

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


def _require_bearer_admin(authorization: str | None) -> None:
    """Require Authorization: Bearer <IMPORT_ADMIN_TOKEN> when configured."""

    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if not required:
        return

    if not authorization:
        raise HTTPException(status_code=401, detail="Admin token required")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or parts[1] != required:
        raise HTTPException(status_code=401, detail="Admin token required")


@router.post("/admin/run-ingestion", status_code=202)
async def admin_run_ingestion(authorization: str | None = Header(None)):
    """Trigger one ingestion cycle asynchronously.

    Returns immediately with 202 to avoid blocking the request.
    """

    _require_bearer_admin(authorization)

    started_at = time.time()

    async def _runner() -> None:
        try:
            total = await run_cycle()
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
    return {"ok": True, "status": "queued"}
