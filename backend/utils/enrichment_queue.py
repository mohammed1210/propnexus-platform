from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return _now_utc().isoformat()


def enqueue_job(supabase: Any, property_id: str, delay_seconds: int = 0) -> None:
    pid = (property_id or "").strip()
    if not pid:
        return

    run_after = _now_utc() + timedelta(seconds=max(0, int(delay_seconds or 0)))

    row = {
        "property_id": pid,
        "status": "pending",
        "attempts": 0,
        "last_error": None,
        "run_after": run_after.isoformat(),
        "updated_at": now_iso(),
    }

    # Some supabase/postgrest client versions support `on_conflict=`.
    try:
        supabase.table("enrichment_jobs").upsert(row, on_conflict="property_id").execute()
    except TypeError:
        supabase.table("enrichment_jobs").upsert(row).execute()


def fetch_next_job(supabase: Any) -> Optional[Dict[str, Any]]:
    res = (
        supabase.table("enrichment_jobs")
        .select("*")
        .eq("status", "pending")
        .lte("run_after", now_iso())
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    if isinstance(data, list) and data:
        return data[0] if isinstance(data[0], dict) else None
    return None


def mark_processing(supabase: Any, job_id: int) -> None:
    supabase.table("enrichment_jobs").update({"status": "processing", "updated_at": now_iso()}).eq(
        "id", int(job_id)
    ).execute()


def mark_done(supabase: Any, job_id: int) -> None:
    supabase.table("enrichment_jobs").update({"status": "done", "updated_at": now_iso()}).eq(
        "id", int(job_id)
    ).execute()


def mark_failed(
    supabase: Any,
    job_id: int,
    attempts: int,
    error: str,
    backoff_seconds: int,
) -> None:
    run_after = _now_utc() + timedelta(seconds=max(0, int(backoff_seconds or 0)))
    supabase.table("enrichment_jobs").update(
        {
            "status": "pending" if int(attempts) < 5 else "failed",
            "attempts": int(attempts),
            "last_error": (error or "")[:500],
            "run_after": run_after.isoformat(),
            "updated_at": now_iso(),
        }
    ).eq("id", int(job_id)).execute()


def queue_stats(supabase: Any) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for s in ["pending", "processing", "done", "failed"]:
        r = supabase.table("enrichment_jobs").select("id", count="exact").eq("status", s).execute()
        out[s] = int(getattr(r, "count", 0) or 0)
    return out
