import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from supabase import Client, create_client

router = APIRouter(prefix="/off-market", tags=["off-market"])
logger = logging.getLogger(__name__)

# --- Supabase client ---
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Optional[Client] = (
    create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
)

ADMIN_TOKEN = os.getenv("OFF_MARKET_ADMIN_TOKEN", "").strip()


def require_admin(x_api_key: Optional[str] = Header(default=None)):
    if ADMIN_TOKEN and (x_api_key or "").strip() != ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    return True


# ---------- Schemas ----------
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


# ---------- Routes ----------
@router.post(
    "/create", response_model=CreateDealResponse, dependencies=[Depends(require_admin)]
)
def create_off_market_deal(payload: CreateDealRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    data = payload.model_dump()  # pydantic v2
    try:
        res = supabase.table("off_market_deals").insert(data).select("*").execute()
        if not res.data:
            raise HTTPException(status_code=502, detail="Insert failed")
        return CreateDealResponse(**res.data[0])
    except Exception as e:
        logger.exception("Failed to create off-market deal")
        raise HTTPException(status_code=500, detail="Failed to create deal") from e


# ✅ add this route so frontend /off-market/generate-off-market works
class GenerateRequest(BaseModel):
    location: str = Field(..., min_length=2)
    budget: float = Field(..., ge=0)
    count: int = Field(5, ge=1, le=10)  # must be ≥1 (cap at 10 for sanity)


@router.post("/generate-off-market")
async def generate_off_market(payload: GenerateRequest):
    """
    Temporary generator that synthesizes off-market deals.
    Guards against bad inputs (e.g., zero/negative count) to prevent 500s.
    """
    # Extra runtime hardening (belt & braces)
    location = (payload.location or "").strip()
    budget = max(0.0, float(payload.budget or 0))
    count = max(1, min(10, int(payload.count or 1)))

    unit_price = budget / max(1, count)

    deals = [
        {
            "address": f"Demo address {i+1}, {location}",
            "price": unit_price,
            "description": "Generated placeholder deal",
        }
        for i in range(count)
    ]
    return {"deals": deals}
