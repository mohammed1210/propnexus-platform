from __future__ import annotations

import os
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

router = APIRouter(tags=["properties"])

# Allowed sort columns (tests expect invalid -> fallback, not 500)
ALLOWED_SORT_COLS = {
    "created_at",
    "price",
    "bedrooms",
    "bathrooms",
    "yield_percent",
    "roi_percent",
    "ai_score",
}


def _get_supabase():
    """
    Lazily create Supabase client so unit tests can patch create_client.
    Also avoids crashing if env vars aren't set in CI.
    """
    url = os.getenv("SUPABASE_URL") or "http://localhost"
    key = os.getenv("SUPABASE_KEY") or "anon"
    return create_client(url, key)


@router.get("/properties")
def list_properties(
    q: Optional[str] = Query(default=None),
    min: Optional[int] = Query(
        default=None
    ),  # noqa: A002 (min is fine here; matches existing API usage)
    max: Optional[int] = Query(default=None),  # noqa: A002
    beds: Optional[int] = Query(default=None),
    baths: Optional[int] = Query(default=None),
    types: Optional[str] = Query(default=None, description="Comma-separated investment types"),
    sort: Optional[str] = Query(default=None),
    dir: str = Query(default="desc"),
    limit: int = Query(default=200, ge=1, le=1000),
):
    try:
        sb = _get_supabase()
        query = sb.table("properties").select("*")

        # Search across common fields
        if q:
            q_esc = q.replace("%", "").strip()
            if q_esc:
                # Supabase .or_ expects a comma-separated filter string
                query = query.or_(f"title.ilike.%{q_esc}%,location.ilike.%{q_esc}%")

        # Numeric filters
        if min is not None:
            query = query.gte("price", min)
        if max is not None:
            query = query.lte("price", max)
        if beds is not None:
            query = query.gte("bedrooms", beds)
        if baths is not None:
            query = query.gte("bathrooms", baths)

        # Types filter
        if types:
            type_list: List[str] = [t.strip() for t in types.split(",") if t.strip()]
            if type_list:
                query = query.in_("investment_type", type_list)

        # Sort fallback behaviour (tests expect this)
        sort_col = sort if (sort in ALLOWED_SORT_COLS) else "created_at"
        ascending = (dir or "").lower() == "asc"
        query = query.order(sort_col, desc=not ascending)

        query = query.limit(limit)
        res = query.execute()
        return res.data or []

    except HTTPException:
        raise
    except Exception as e:
        # Never 500 silently: return message for debugging
        raise HTTPException(status_code=500, detail=f"properties list failed: {e}")


@router.get("/properties/{property_id}")
def get_property(property_id: str):
    try:
        sb = _get_supabase()
        query = sb.table("properties").select("*").eq("id", property_id).maybe_single()
        res = query.execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Property not found")

        return res.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"property fetch failed: {e}")
