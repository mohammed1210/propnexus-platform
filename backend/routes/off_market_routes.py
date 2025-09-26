# backend/routes/off_market_routes.py
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

# Optional Supabase client
_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_KEY = os.getenv("SUPABASE_KEY")

try:
    if _SUPABASE_URL and _SUPABASE_KEY:
        from supabase import Client, create_client  # type: ignore

        _sb: Optional[Client] = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    else:
        _sb = None
except Exception:
    _sb = None


router = APIRouter()


# ---------- Schemas ----------
class GenerateRequest(BaseModel):
    location: str = Field(..., examples=["Reading"])
    budget: float = Field(..., ge=0)
    count: int = Field(5, ge=1, le=50)


class GeneratedDeal(BaseModel):
    address: str
    price: float
    description: str = "Generated placeholder deal"


class CreateDealRequest(BaseModel):
    title: str
    location: str
    price: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    investment_type: Optional[str] = None
    contact: Optional[str] = None
    notes: Optional[str] = None


# ---------- Routes ----------
@router.post("/off-market/generate-off-market", response_model=dict)
def generate_off_market(payload: GenerateRequest) -> dict:
    """Return dummy deals; accepts JSON body (Option B)."""
    per = (payload.budget / max(payload.count, 1)) if payload.count else payload.budget
    deals: List[GeneratedDeal] = [
        GeneratedDeal(
            address=f"Demo address {i+1}, {payload.location}", price=round(per, 2)
        )
        for i in range(payload.count)
    ]
    return {"deals": [d.model_dump() for d in deals]}


@router.post("/off-market/create", response_model=dict)
def create_off_market(
    body: CreateDealRequest,
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> dict:
    """Admin-gated create. Requires X-API-Key that matches OFF_MARKET_ADMIN_TOKEN."""
    admin_token = os.getenv("OFF_MARKET_ADMIN_TOKEN") or ""
    if not admin_token or x_api_key != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden: invalid API key")

    record = body.model_dump()

    if _sb:
        try:
            _sb.table("off_market_deals").insert(
                {
                    "title": record.get("title"),
                    "location": record.get("location"),
                    "price": record.get("price"),
                    "notes": record.get("notes") or "Created via API",
                }
            ).execute()
        except Exception:
            pass

    return {"ok": True, "deal": record}
