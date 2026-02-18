from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Header, HTTPException, Query, Request

from backend.utils.admin_auth import require_admin

try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None

router = APIRouter(prefix="/admin", tags=["admin"])


def _parse_ts(v: Any) -> datetime | None:
    if not isinstance(v, str) or not v.strip():
        return None
    s = v.strip()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


@router.get("/scrape-runs")
def get_scrape_runs(
    request: Request,
    days: int = Query(7, ge=1, le=365),
    _x_admin_token: str | None = Header(None),
):
    """Return daily totals per source and recent raw runs."""

    require_admin(request)

    if not sb:
        raise HTTPException(status_code=503, detail="Supabase client not configured")

    cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))
    cutoff_iso = cutoff.isoformat()

    # Recent raw runs (for troubleshooting)
    try:
        recent_resp = (
            sb.table("scrape_runs")
            .select(
                "id,source,location,status,count_inserted,error,started_at,finished_at,created_at"
            )
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        recent: List[Dict[str, Any]] = list(getattr(recent_resp, "data", []) or [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scrape_runs: {e}")

    # Totals for last N days
    try:
        totals_resp = (
            sb.table("scrape_runs")
            .select("source,created_at,status,count_inserted")
            .gte("created_at", cutoff_iso)
            .execute()
        )
        rows: List[Dict[str, Any]] = list(getattr(totals_resp, "data", []) or [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scrape_runs totals: {e}")

    agg: Dict[Tuple[str, str], int] = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        if str(r.get("status") or "").lower() != "success":
            continue
        src = str(r.get("source") or "").strip().lower() or "unknown"
        ts = _parse_ts(r.get("created_at"))
        if ts is None:
            continue
        day = ts.date().isoformat()
        key = (day, src)
        try:
            n = int(r.get("count_inserted") or 0)
        except Exception:
            n = 0
        agg[key] = agg.get(key, 0) + n

    totals = [
        {"day": day, "source": src, "count_inserted": count}
        for (day, src), count in sorted(agg.items(), key=lambda x: (x[0][0], x[0][1]))
    ]

    return {
        "days": int(days),
        "cutoff": cutoff_iso,
        "totals": totals,
        "recent_runs": recent,
    }
