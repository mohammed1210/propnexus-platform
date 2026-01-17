from __future__ import annotations

from fastapi import APIRouter, HTTPException

try:
    from backend.db import sb  # type: ignore
except Exception:  # pragma: no cover
    sb = None


router = APIRouter(tags=["debug"])


@router.get("/debug/properties-count")
def properties_count():
    """Debug endpoint to confirm Supabase has `properties` rows."""

    if not sb:
        raise HTTPException(status_code=500, detail="Missing Supabase env vars")

    res = sb.table("properties").select("id", count="exact").limit(1).execute()
    return {"count": getattr(res, "count", None)}
