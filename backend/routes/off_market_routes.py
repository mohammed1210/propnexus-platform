from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from supabase import Client, create_client

router = APIRouter(prefix="/off-market", tags=["off-market"])
logger = logging.getLogger("uvicorn.error")  # logs show up in Railway

# --- Supabase client -----------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)
supabase: Optional[Client] = (
    create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
)

ADMIN_TOKEN = (os.getenv("OFF_MARKET_ADMIN_TOKEN") or "").strip()


def require_admin(x_api_key: Optional[str] = Header(default=None)) -> bool:
    """
    Require a matching admin token when OFF_MARKET_ADMIN_TOKEN is set.
    If the env var is empty, the check is skipped (useful for local dev).
    """
    if ADMIN_TOKEN and (x_api_key or "").strip() != ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    return True


def _sb() -> Client:
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return supabase


# ---------- Schemas ------------------------------------------------------------
class CreateDealRequest(BaseModel):
    title: str = Field(..., min_length=2)
    location: str = Field(..., min_length=2)
    price: Optional[float] = Field(None, ge=0)
    bedrooms: Optional[int] = Field(None, ge=0, le=20)
    bathrooms: Optional[int] = Field(None, ge=0, le=20)
    investment_type: Optional[str] = Field(None, max_length=50)
    contact: Optional[str] = Field(None, max_length=120)
    source: Optional[str] = Field("Manual", max_length=80)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("title", "location")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class CreateDealResponse(BaseModel):
    id: str
    title: str
    location: Optional[str] = None
    price: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    investment_type: Optional[str] = None
    contact: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None


# ---------- Routes -------------------------------------------------------------
@router.post(
    "/create",
    response_model=CreateDealResponse,
    dependencies=[Depends(require_admin)],
)
def create_off_market_deal(payload: CreateDealRequest):
    """
    Insert a new row into public.off_market_deals.
    Returns the inserted record so the frontend can render immediately.
    """
    sb = _sb()
    try:
        data = payload.model_dump()
        # Using .select("*") ensures PostgREST returns the full inserted row
        res = sb.table("off_market_deals").insert(data).select("*").execute()
    except Exception as e:
        logger.exception("Supabase exception on POST /off-market/create")
        raise HTTPException(status_code=502, detail="Database upstream error") from e

    if getattr(res, "error", None):
        logger.error("Supabase error on POST /off-market/create: %s", res.error)
        raise HTTPException(status_code=502, detail=str(res.error))

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=502, detail="Insert returned no data")

    return CreateDealResponse(**rows[0])


# Simple generator endpoint (guard against zero/negative count)
class GenerateRequest(BaseModel):
    location: str = Field(..., min_length=2)
    budget: float = Field(..., gt=0)
    count: int = Field(default=5, ge=1, le=50)


@router.post("/generate-off-market")
async def generate_off_market(payload: GenerateRequest):
    per_deal_price = payload.budget / float(payload.count)
    return {
        "deals": [
            {
                "address": f"Demo address {i + 1}, {payload.location}",
                "price": per_deal_price,
                "description": "Generated placeholder deal",
            }
            for i in range(payload.count)
        ]
    }
