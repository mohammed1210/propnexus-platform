# /backend/routes/save_deal.py

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, create_client

# ---- Supabase client (prefer service role on the server) --------------------
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials missing: SUPABASE_URL / SUPABASE_KEY")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


# ---- Models -----------------------------------------------------------------
class SaveDealIn(BaseModel):
    property_id: str = Field(..., min_length=1)
    title: Optional[str] = Field(None, max_length=300)
    location: Optional[str] = Field(None, max_length=200)
    price: Optional[float] = Field(None, ge=0)
    bedrooms: Optional[int] = Field(None, ge=0, le=50)
    bathrooms: Optional[int] = Field(None, ge=0, le=50)
    yield_percent: Optional[float] = Field(None, ge=0, le=100)
    roi_percent: Optional[float] = Field(None, ge=0, le=100)
    imageurl: Optional[str] = Field(None, max_length=2000)
    investment_type: Optional[str] = Field(None, max_length=100)
    saved_at: Optional[str] = None  # will default to now() if not provided


class SaveDealOut(SaveDealIn):
    id: str


# ---- Helpers ----------------------------------------------------------------
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- Routes -----------------------------------------------------------------
@router.post(
    "/save-deal", response_model=SaveDealOut, status_code=status.HTTP_201_CREATED
)
def save_deal(payload: SaveDealIn):
    """Insert a single saved deal row into `saved_deals`."""
    record = payload.dict()
    record["saved_at"] = record.get("saved_at") or _iso_now()

    try:
        res = sb.table("saved_deals").insert(record).select("*").execute()
    except Exception as e:
        # Typically connection/env errors
        raise HTTPException(status_code=500, detail=f"Supabase error: {e}") from e

    if getattr(res, "error", None):
        # Older supabase-py surfaces .error; newer returns .data/.count
        raise HTTPException(status_code=502, detail=str(res.error))

    data = res.data or []
    if not data:
        raise HTTPException(status_code=502, detail="Insert failed with empty response")

    return SaveDealOut(**data[0])


@router.get("/saved-deals", response_model=list[SaveDealOut])
def list_saved_deals():
    """Return all saved deals, newest first."""
    try:
        res = sb.table("saved_deals").select("*").order("saved_at", desc=True).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {e}") from e

    if getattr(res, "error", None):
        raise HTTPException(status_code=502, detail=str(res.error))

    return [SaveDealOut(**row) for row in (res.data or [])]


@router.delete("/saved-deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_deal(deal_id: str):
    """Delete a saved deal by ID."""
    try:
        res = sb.table("saved_deals").delete().eq("id", deal_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase error: {e}") from e

    if getattr(res, "error", None):
        raise HTTPException(status_code=502, detail=str(res.error))

    # No body for 204
    return None
