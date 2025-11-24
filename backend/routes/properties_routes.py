# backend/routes/properties_routes.py
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from supabase import create_client, Client

router = APIRouter(prefix="/properties", tags=["properties"])

# --- Supabase setup (server-side) ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Try multiple environment variable names for service role key:
# 1. SUPABASE_SERVICE_ROLE_KEY (preferred, standard naming)
# 2. SUPABASE_SERVICE_ROLE (legacy, used in some deployments)
# 3. SUPABASE_KEY (fallback, may be anon key in some setups)
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") 
    or os.getenv("SUPABASE_SERVICE_ROLE") 
    or os.getenv("SUPABASE_KEY")
)


def get_sb() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured on the backend (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
        )
    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase init failed: {e}")


ALLOWED_SORT = {"price", "created_at", "bedrooms", "yield_percent", "roi_percent"}

SELECT_COLS = (
    "id,title,location,price,bedrooms,bathrooms,yield_percent,roi_percent,"
    "imageurl,latitude,longitude,created_at,description,investmentType"
)


@router.get("")
def list_properties(
    q: Optional[str] = Query(default=None, description="Search in title or location"),
    min: Optional[int] = Query(default=None, ge=0, description="Minimum price"),
    max: Optional[int] = Query(default=None, ge=0, description="Maximum price"),
    beds: Optional[int] = Query(default=None, ge=0, description="Minimum bedrooms"),
    baths: Optional[int] = Query(default=None, ge=0, description="Minimum bathrooms"),
    types: Optional[str] = Query(default=None, description="Comma-separated investment types"),
    sort: str = Query(default="created_at", description="Sort column"),
    dir: str = Query(default="desc", pattern="^(asc|desc)$", description="Sort direction"),
    limit: int = Query(default=200, ge=1, le=500),
):
    sb = get_sb()

    # Validate sort
    sort_col = sort if sort in ALLOWED_SORT else "created_at"
    desc = dir.lower() != "asc"

    try:
        query = sb.table("properties").select(SELECT_COLS).limit(limit)

        # Filters
        if q:
            # search title OR location (case-insensitive)
            query = query.or_(f"title.ilike.%{q}%,location.ilike.%{q}%")
        if min is not None:
            query = query.gte("price", min)
        if max is not None and max > 0:
            query = query.lte("price", max)
        if beds is not None and beds > 0:
            query = query.gte("bedrooms", beds)
        if baths is not None and baths > 0:
            query = query.gte("bathrooms", baths)
        if types:
            # Split comma-separated types and filter
            type_list = [t.strip() for t in types.split(",") if t.strip()]
            if type_list:
                query = query.in_("investmentType", type_list)

        # Order
        query = query.order(sort_col, desc=desc, nulls_first=not desc)

        res = query.execute()
        data = getattr(res, "data", None) or []
        return JSONResponse(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list properties: {e}")


@router.get("/{prop_id}")
def get_property(prop_id: str):
    sb = get_sb()
    try:
        res = sb.table("properties").select(SELECT_COLS).eq("id", prop_id).maybe_single().execute()
        data = getattr(res, "data", None)
        if not data:
            raise HTTPException(status_code=404, detail="Property not found")
        return JSONResponse(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch property: {e}")
