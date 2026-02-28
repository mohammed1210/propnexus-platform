from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from backend.utils.supabase_client import get_supabase

_CACHED_SB: Any | None = None


def _get_supabase_from_env() -> Any | None:
    """Best-effort Supabase client.

    Kept local to avoid importing backend.db (which can have side effects).
    """

    global _CACHED_SB
    if _CACHED_SB is not None:
        return _CACHED_SB

    try:
        _CACHED_SB = get_supabase(required=False)
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


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    name = (table_name or "").strip()
    if not name:
        return False

    msg = str(exc) or ""
    if not msg:
        payload = exc.args[0] if getattr(exc, "args", None) else None
        msg = payload.get("message") if isinstance(payload, dict) else ""
    msg = msg or ""

    # PostgREST/Supabase commonly formats missing-table errors this way.
    return "does not exist" in msg and (
        f"public.{name}" in msg or f'"{name}"' in msg or name in msg
    )


def list_newest_property_ids_needing_enrichment(
    limit: int = 100,
    hours: int = 24,
    *,
    sb: Any | None = None,
    now: datetime | None = None,
) -> Dict[str, Any]:
    """Select newest property IDs that likely need enrichment.

    Excludes rows that were enriched recently (property_enrichment_cache.fetched_at)
    or that are already in the queue recently (enrichment_jobs pending/processing).

    Returns a dict shaped for easy API responses:
      { ok, scanned, eligible, ids?, error? }

    Safe behavior:
    - If Supabase isn't configured or required tables are missing, returns ok=False.
    """

    try:
        lim = int(limit or 0)
    except Exception:
        lim = 100
    lim = max(1, min(lim, 200))

    try:
        hrs = int(hours or 0)
    except Exception:
        hrs = 24
    hrs = max(1, min(hrs, 24 * 14))

    client = sb or _get_supabase_from_env()
    if not client:
        return {
            "ok": False,
            "scanned": 0,
            "eligible": 0,
            "ids": [],
            "error": "Supabase not configured",
        }

    anchor = now.astimezone(timezone.utc) if isinstance(now, datetime) else _now_utc()
    cutoff_iso = (anchor - timedelta(hours=hrs)).isoformat()

    # Scan newest within window; overscan to allow exclusions.
    scan_limit = min(2000, max(200, lim * 10))

    try:
        res = (
            client.table("properties")
            .select("id,created_at")
            .gte("created_at", cutoff_iso)
            .order("created_at", desc=True)
            .limit(int(scan_limit))
            .execute()
        )
        rows = getattr(res, "data", None) or []
    except Exception as e:
        return {
            "ok": False,
            "scanned": 0,
            "eligible": 0,
            "ids": [],
            "error": f"Failed to query properties: {e}",
        }

    candidate_ids: list[str] = []
    if isinstance(rows, list):
        for r in rows:
            if not isinstance(r, dict):
                continue
            pid = r.get("id")
            if isinstance(pid, str) and pid.strip():
                candidate_ids.append(pid.strip())

    scanned = len(candidate_ids)
    if scanned == 0:
        return {"ok": True, "scanned": 0, "eligible": 0, "ids": []}

    # Exclude recently enriched.
    try:
        cache_res = (
            client.table("property_enrichment_cache")
            .select("property_id,fetched_at")
            .in_("property_id", candidate_ids)
            .gte("fetched_at", cutoff_iso)
            .execute()
        )
        cache_rows = getattr(cache_res, "data", None) or []
    except Exception as e:
        if _is_missing_table_error(e, "property_enrichment_cache"):
            return {
                "ok": False,
                "scanned": scanned,
                "eligible": 0,
                "ids": [],
                "error": "Missing table 'public.property_enrichment_cache'",
            }
        return {
            "ok": False,
            "scanned": scanned,
            "eligible": 0,
            "ids": [],
            "error": f"Failed to query property_enrichment_cache: {e}",
        }

    enriched_recently: set[str] = set()
    if isinstance(cache_rows, list):
        for r in cache_rows:
            if isinstance(r, dict) and isinstance(r.get("property_id"), str):
                enriched_recently.add(r["property_id"].strip())

    # Exclude recently enqueued pending/processing.
    try:
        jobs_res = (
            client.table("enrichment_jobs")
            .select("property_id,status,updated_at")
            .in_("property_id", candidate_ids)
            .in_("status", ["pending", "processing"])
            .gte("updated_at", cutoff_iso)
            .execute()
        )
        jobs_rows = getattr(jobs_res, "data", None) or []
    except Exception as e:
        if _is_missing_table_error(e, "enrichment_jobs") or _is_missing_queue_table_error(e):
            return {
                "ok": False,
                "scanned": scanned,
                "eligible": 0,
                "ids": [],
                "error": "Missing table 'public.enrichment_jobs'",
            }
        return {
            "ok": False,
            "scanned": scanned,
            "eligible": 0,
            "ids": [],
            "error": f"Failed to query enrichment_jobs: {e}",
        }

    enqueued_recently: set[str] = set()
    if isinstance(jobs_rows, list):
        for r in jobs_rows:
            if isinstance(r, dict) and isinstance(r.get("property_id"), str):
                enqueued_recently.add(r["property_id"].strip())

    eligible_ids: list[str] = []
    for pid in candidate_ids:
        if pid in enriched_recently:
            continue
        if pid in enqueued_recently:
            continue
        eligible_ids.append(pid)
        if len(eligible_ids) >= lim:
            break

    return {
        "ok": True,
        "scanned": scanned,
        "eligible": len(eligible_ids),
        "ids": eligible_ids,
    }


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
