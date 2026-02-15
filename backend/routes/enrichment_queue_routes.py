from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.utils.enrichment_queue import enqueue_job, queue_stats
from backend.utils.supabase_client import get_supabase

try:
    from postgrest.exceptions import APIError  # type: ignore
except Exception:  # pragma: no cover
    APIError = Exception  # type: ignore

router = APIRouter(prefix="/enrich/queue", tags=["enrich"])


def _raise_if_queue_table_missing(exc: Exception) -> None:
    if not isinstance(exc, APIError):
        return
    payload = exc.args[0] if exc.args else None
    msg = payload.get("message") if isinstance(payload, dict) else str(exc)
    if not msg:
        return
    if 'relation "public.enrichment_jobs" does not exist' in msg or "enrichment_jobs" in msg:
        raise HTTPException(
            status_code=503,
            detail=(
                "Enrichment queue is not initialized in Supabase (missing table 'public.enrichment_jobs'). "
                "Apply backend/sql/2026-02-15_enrichment_jobs.sql in the Supabase SQL editor, then retry."
            ),
        )


@router.get("/stats")
def get_queue_stats() -> Dict[str, int]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        return queue_stats(sb)
    except Exception as e:
        _raise_if_queue_table_missing(e)
        raise


@router.get("/jobs")
def list_jobs(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        q = sb.table("enrichment_jobs").select("*").order("created_at", desc=True).limit(int(limit))
        if status:
            q = q.eq("status", str(status))

        res = q.execute()
        rows = res.data or []
        return {"items": rows if isinstance(rows, list) else []}
    except Exception as e:
        _raise_if_queue_table_missing(e)
        raise


@router.post("/enqueue/{property_id}")
def enqueue_one(property_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        enqueue_job(sb, property_id)
        return {"ok": True, "property_id": property_id}
    except Exception as e:
        _raise_if_queue_table_missing(e)
        raise


@router.post("/enqueue-newest")
def enqueue_newest(limit: int = Query(default=25, ge=1, le=200)) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        res = (
            sb.table("properties")
            .select("id")
            .order("created_at", desc=True)
            .limit(int(limit))
            .execute()
        )
        rows = res.data or []
        ids: List[str] = []
        if isinstance(rows, list):
            for r in rows:
                if isinstance(r, dict) and isinstance(r.get("id"), str) and r["id"].strip():
                    ids.append(r["id"].strip())

        for i, pid in enumerate(ids):
            enqueue_job(sb, pid, delay_seconds=i)

        return {"ok": True, "enqueued": len(ids)}
    except Exception as e:
        _raise_if_queue_table_missing(e)
        raise
