from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.utils.enrichment_queue import enqueue_job, queue_stats
from backend.utils.supabase_client import get_supabase

router = APIRouter(prefix="/enrich/queue", tags=["enrich"])


@router.get("/stats")
def get_queue_stats() -> Dict[str, int]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return queue_stats(sb)


@router.get("/jobs")
def list_jobs(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    q = sb.table("enrichment_jobs").select("*").order("created_at", desc=True).limit(int(limit))
    if status:
        q = q.eq("status", str(status))

    res = q.execute()
    rows = res.data or []
    return {"items": rows if isinstance(rows, list) else []}


@router.post("/enqueue/{property_id}")
def enqueue_one(property_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    enqueue_job(sb, property_id)
    return {"ok": True, "property_id": property_id}


@router.post("/enqueue-newest")
def enqueue_newest(limit: int = Query(default=25, ge=1, le=200)) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")

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
