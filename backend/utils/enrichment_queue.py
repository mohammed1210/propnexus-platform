from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

_CACHED_SB: Any | None = None


def _get_supabase_from_env() -> Any | None:
    """Best-effort Supabase client.

    Kept local to avoid importing backend.db (which can have side effects).
    """

    global _CACHED_SB
    if _CACHED_SB is not None:
        return _CACHED_SB

    url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()

    if not url or not key:
        return None

    try:
        from supabase import create_client  # type: ignore

        _CACHED_SB = create_client(url, key)
        return _CACHED_SB
    except Exception:
        return None


def _is_missing_queue_table_error(exc: Exception) -> bool:
    msg = str(exc) or ""
    if not msg:
        payload = exc.args[0] if getattr(exc, "args", None) else None
        msg = payload.get("message") if isinstance(payload, dict) else ""
    msg = msg or ""
    return (
        'relation "public.enrichment_jobs" does not exist' in msg
        or "enrichment_jobs" in msg
        and "does not exist" in msg
    )


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


def enqueue_property_ids(
    property_ids: list[str],
    reason: str,
    max_per_call: int = 200,
) -> Dict[str, int]:
    """Bulk enqueue property ids into enrichment_jobs.

    - Dedupes ids.
    - Inserts with conflict-safe semantics (do not overwrite existing jobs).
    - Rate-limits by staggering run_after (1s increments).
    - Safe no-op if Supabase or enrichment_jobs table is unavailable.
    """

    # Defensive normalize + dedupe (preserve order).
    seen: set[str] = set()
    ids: list[str] = []
    for pid in property_ids or []:
        if not isinstance(pid, str):
            continue
        s = pid.strip()
        if not s or s in seen:
            continue
        seen.add(s)
        ids.append(s)

    requested = len(ids)
    if requested == 0:
        return {"requested": 0, "attempted": 0, "enqueued": 0}

    try:
        limit = max(1, int(max_per_call or 0))
    except Exception:
        limit = 200

    ids = ids[:limit]
    attempted = len(ids)

    sb = _get_supabase_from_env()
    if not sb:
        return {"requested": requested, "attempted": attempted, "enqueued": 0}

    base = _now_utc()
    rows: list[dict[str, Any]] = []
    for i, pid in enumerate(ids):
        run_after = base + timedelta(seconds=i)
        rows.append(
            {
                "property_id": pid,
                "status": "pending",
                "attempts": 0,
                "last_error": None,
                "run_after": run_after.isoformat(),
                "updated_at": now_iso(),
            }
        )

    # Prefer conflict-safe upsert with ignore_duplicates if supported.
    try:
        res = (
            sb.table("enrichment_jobs")
            .upsert(
                rows,
                on_conflict="property_id",
                ignore_duplicates=True,  # type: ignore[arg-type]
            )
            .execute()
        )
        data = getattr(res, "data", None)
        enqueued = len(data) if isinstance(data, list) and data else attempted
        return {"requested": requested, "attempted": attempted, "enqueued": int(enqueued)}
    except TypeError:
        # Older clients: fall back to per-row insert to avoid overwriting.
        pass
    except Exception as e:
        if _is_missing_queue_table_error(e):
            return {"requested": requested, "attempted": attempted, "enqueued": 0}
        # Fall back to per-row insert.
        pass

    enq = 0
    for row in rows:
        try:
            sb.table("enrichment_jobs").insert(row).execute()
            enq += 1
        except Exception as e:
            if _is_missing_queue_table_error(e):
                return {"requested": requested, "attempted": attempted, "enqueued": 0}
            continue

    return {"requested": requested, "attempted": attempted, "enqueued": int(enq)}


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
