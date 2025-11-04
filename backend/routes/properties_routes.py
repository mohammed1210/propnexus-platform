# backend/routes/properties_routes.py
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from supabase import Client, create_client

router = APIRouter(tags=["properties"])

# ---- Supabase (service-role) ----
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    sb: Optional[Client] = None
else:
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        sb = None


def _row_shape(r: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a property row so the frontend always receives the same keys.
    """
    return {
        "id": r.get("id"),
        "title": r.get("title"),
        "location": r.get("location"),
        "price": r.get("price"),
        "bedrooms": r.get("bedrooms"),
        "bathrooms": r.get("bathrooms"),
        "yield_percent": r.get("yield_percent"),
        "roi_percent": r.get("roi_percent"),
        "imageurl": r.get("imageurl"),
        "latitude": r.get("latitude"),
        "longitude": r.get("longitude"),
        "created_at": r.get("created_at"),
    }


@router.get("/properties")
def get_properties(
    q: Optional[str] = Query(default=None, description="Free-text (title/location)"),
    min: Optional[int] = Query(default=None, ge=0, description="Min price"),
    max: Optional[int] = Query(default=None, ge=0, description="Max price"),
    beds: Optional[int] = Query(default=None, ge=0, description="Min bedrooms"),
    limit: int = Query(default=200, ge=1, le=500),
):
    """
    Read-only listings endpoint. Bypasses RLS via service role so signed-in vs signed-out
    users see the same public data. All filtering is server-side.
    """
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase is not configured")

    # Base select
    query = (
        sb.table("properties")
        .select(
            "id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,imageurl,latitude,longitude,created_at"
        )
        .order("created_at", desc=True)
        .limit(limit)
    )

    # Filters
    if q:
        # title OR location ilike
        query = query.or_(f"title.ilike.%{q}%,location.ilike.%{q}%")
    if min is not None and min > 0:
        query = query.gte("price", min)
    if max is not None and max > 0:
        query = query.lte("price", max)
    if beds is not None and beds > 0:
        query = query.gte("bedrooms", beds)

    # Execute
    try:
        res = query.execute()
        rows: List[dict] = []
        if res and hasattr(res, "data"):
            if isinstance(res.data, list):
                rows = res.data
            elif isinstance(res.data, dict):
                # sometimes a single row shape; normalize to list
                rows = [res.data]
        # Normalize
        out = [_row_shape(r or {}) for r in rows]
        return JSONResponse(out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase query failed: {e}")
    