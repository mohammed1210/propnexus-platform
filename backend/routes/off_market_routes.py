# backend/routes/off_market_routes.py
import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from supabase import Client, create_client

# -----------------------------------------------------------------------------
# Supabase client (lazy init)
# -----------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------
router = APIRouter(prefix="/off-market", tags=["off-market"])


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------
class DealIn(BaseModel):
    title: str
    location: str
    price: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    investment_type: Optional[str] = None
    contact: Optional[str] = None
    notes: Optional[str] = None


class DealOut(BaseModel):
    address: str
    price: float
    description: str


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@router.post("/generate-off-market")
def generate_off_market(location: str, budget: float, count: int = 3) -> dict:
    """Return placeholder generated deals (no DB)."""
    deals = [
        DealOut(
            address=f"Demo address {i+1}, {location}",
            price=100000.0,
            description="Generated placeholder deal",
        ).dict()
        for i in range(count)
    ]
    return {"deals": deals}


@router.post("/create")
def create_off_market(
    deal: DealIn,
    x_api_key: Optional[str] = Header(None, convert_underscores=False),
):
    """Admin-gated endpoint to insert a deal into Supabase."""
    admin_token = os.getenv("OFF_MARKET_ADMIN_TOKEN")
    if not admin_token:
        raise HTTPException(status_code=500, detail="Admin token not set in backend")
    if x_api_key != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden: invalid API key")

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        data = deal.dict()
        resp = supabase.table("off_market_deals").insert(data).execute()
        return {"ok": True, "data": resp.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase insert failed: {e}")
