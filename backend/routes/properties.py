# backend/routes/properties.py
from __future__ import annotations

from typing import Any, Dict, List

from db import get_supabase  # lazy getter from backend/db.py
from fastapi import APIRouter, HTTPException

router = APIRouter()

# Match your Supabase table
TABLE = "property_listings"


def _sb():
    """Lazy fetch Supabase client or raise 503 if not configured."""
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return sb


@router.get("/properties/{property_id}")
def get_property_by_id(property_id: str) -> Dict[str, Any]:
    """
    Fetch a single property by UUID.
    Returns 404 if not found.
    """
    try:
        res = _sb().table(TABLE).select("*").eq("id", property_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Property not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database upstream error: {e}")


@router.get("/properties")
def list_properties(limit: int = 20) -> List[Dict[str, Any]]:
    """
    List up to {limit} properties from property_listings.
    """
    try:
        res = _sb().table(TABLE).select("*").limit(limit).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database upstream error: {e}")
