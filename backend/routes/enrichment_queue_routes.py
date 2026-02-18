from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request

from backend.utils.admin_auth import require_admin
from backend.utils.enrichment_queue import (
    enqueue_job,
    list_newest_property_ids_needing_enrichment,
    queue_stats,
)
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


@router.post("/enqueue-newest-daily")
def enqueue_newest_daily(
    request: Request,
    limit: int = Query(default=100, ge=1, le=200),
    hours: int = Query(default=24, ge=1, le=24 * 14),
    x_admin_token: str | None = Header(None),
) -> Dict[str, Any]:
    """Cron-style endpoint: enqueue newest properties needing enrichment.

    Production safety:
    - Admin protected (x-admin-token).
    - Idempotent-ish: excludes recently enriched and recently queued items.
    - Safe if required tables are missing (returns ok=false, does not crash).
    """

    require_admin(request)

    sb = get_supabase()
    if not sb:
        return {
            "ok": False,
            "scanned": 0,
            "eligible": 0,
            "enqueued": 0,
            "error": "Supabase not configured",
        }

    res = list_newest_property_ids_needing_enrichment(limit=int(limit), hours=int(hours), sb=sb)
    if not bool(res.get("ok")):
        return {
            "ok": False,
            "scanned": int(res.get("scanned") or 0),
            "eligible": int(res.get("eligible") or 0),
            "enqueued": 0,
            **({"error": res.get("error")} if res.get("error") else {}),
        }

    ids = res.get("ids") if isinstance(res, dict) else None
    ids_list: List[str] = (
        [s for s in ids if isinstance(s, str) and s.strip()] if isinstance(ids, list) else []
    )

    enqueued = 0
    for i, pid in enumerate(ids_list):
        try:
            enqueue_job(sb, pid, delay_seconds=i)
            enqueued += 1
        except Exception as e:
            # If the queue table is missing, surface a clean ok=false response.
            try:
                _raise_if_queue_table_missing(e)
            except HTTPException as he:
                return {
                    "ok": False,
                    "scanned": int(res.get("scanned") or 0),
                    "eligible": int(res.get("eligible") or 0),
                    "enqueued": int(enqueued),
                    "error": str(he.detail),
                }
            return {
                "ok": False,
                "scanned": int(res.get("scanned") or 0),
                "eligible": int(res.get("eligible") or 0),
                "enqueued": int(enqueued),
                "error": f"Enqueue failed: {e}",
            }

    return {
        "ok": True,
        "scanned": int(res.get("scanned") or 0),
        "eligible": int(res.get("eligible") or 0),
        "enqueued": int(enqueued),
    }
