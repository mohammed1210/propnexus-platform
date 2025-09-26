# backend/routes/properties.py
from __future__ import annotations

from typing import Any, Dict, Optional

from db import get_supabase
from fastapi import APIRouter, HTTPException

router = APIRouter()


def _first_row(resp: Any) -> Optional[Dict[str, Any]]:
    # postgrest-py returns an object with `.data`; guard it defensively
    if not resp:
        return None
    data = getattr(resp, "data", None)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict) and data:
        return data
    return None


@router.get("/properties/{property_id}")
def get_property_by_id(property_id: str) -> Dict[str, Any]:
    """
    Try `public.properties` first, then fall back to `public.property_listings`.
    Returns 404 only if the ID is in neither table.
    """
    sb = get_supabase()

    # 1) properties
    try:
        res = (
            sb.table("properties").select("*").eq("id", property_id).limit(1).execute()
        )
        row = _first_row(res)
        if row:
            return {"data": row, "source": "properties"}
    except Exception:
        # Soft-fail to the fallback table
        pass

    # 2) property_listings (fallback)
    try:
        res2 = (
            sb.table("property_listings")
            .select("*")
            .eq("id", property_id)
            .limit(1)
            .execute()
        )
        row2 = _first_row(res2)
        if row2:
            return {"data": row2, "source": "property_listings"}
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Property not found")


@router.get("/properties/debug/ids")
def debug_some_ids() -> Dict[str, Any]:
    """
    Returns a few IDs from both tables to help manual testing.
    Remove once you’re happy.
    """
    sb = get_supabase()
    props = sb.table("properties").select("id,title").limit(5).execute().data or []
    listings = (
        sb.table("property_listings").select("id,title").limit(5).execute().data or []
    )
    return {"properties": props, "property_listings": listings}
