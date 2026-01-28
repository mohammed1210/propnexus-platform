from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_scrape_run(
    *,
    source: str,
    location: str | None,
    status: str = "started",
) -> Optional[str]:
    """Insert a scrape_runs row and return its id.

    If Supabase is not configured, this becomes a no-op and returns None.
    """

    try:
        from backend.db import sb  # type: ignore
    except Exception:
        sb = None

    if not sb:
        return None

    payload: dict[str, Any] = {
        "source": (source or "").strip().lower(),
        "location": (location or "").strip() or None,
        "status": (status or "").strip().lower() or "started",
        "started_at": _now_iso(),
    }

    try:
        res = sb.table("scrape_runs").insert(payload).execute()
        data = getattr(res, "data", None)
        if isinstance(data, list) and data:
            run_id = data[0].get("id")
            return str(run_id) if run_id else None
    except Exception:
        return None

    return None


def finish_scrape_run(
    *,
    run_id: str | None,
    status: str,
    count_inserted: int,
    error: str | None = None,
) -> None:
    """Update a scrape_runs row.

    If run_id is None or Supabase is not configured, this is a no-op.
    """

    if not run_id:
        return

    try:
        from backend.db import sb  # type: ignore
    except Exception:
        sb = None

    if not sb:
        return

    patch: dict[str, Any] = {
        "finished_at": _now_iso(),
        "status": (status or "").strip().lower() or "unknown",
        "count_inserted": int(count_inserted or 0),
        "error": error,
    }

    try:
        sb.table("scrape_runs").update(patch).eq("id", run_id).execute()
    except Exception:
        return
