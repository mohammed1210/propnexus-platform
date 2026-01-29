import logging
import os
import random
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field, field_validator
from pydantic.aliases import AliasChoices

from backend.utils.off_market_scoring import compute_off_market_score
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
OFF_MARKET_TABLE = "off_market_leads"


def _missing_column_from_api_error(exc: Exception) -> Optional[str]:
    """Extract missing column name from PostgREST schema cache error."""
    if not isinstance(exc, APIError):
        return None
    if getattr(exc, "code", None) != "PGRST204":
        return None
    msg = str(getattr(exc, "message", "") or "")
    # Pattern: Could not find the 'image_url' column of 'off_market_leads' in the schema cache
    if "Could not find the '" not in msg:
        return None
    try:
        return msg.split("Could not find the '", 1)[1].split("'", 1)[0]
    except Exception:
        return None


def _strip_key(rows: List[dict], key: str) -> List[dict]:
    return [{k: v for k, v in r.items() if k != key} for r in rows]


def _insert_with_schema_fallback(table: str, rows: List[dict]) -> List[dict]:
    """Insert rows, retrying if PostgREST reports missing columns in schema cache."""
    attempts = 0
    current = rows
    while True:
        attempts += 1
        try:
            res = supabase.table(table).insert(current).execute()  # type: ignore[union-attr]
            inserted = res.data or []
            return inserted if isinstance(inserted, list) else []
        except Exception as exc:
            missing = _missing_column_from_api_error(exc)
            if missing and attempts <= 5:
                current = _strip_key(current, missing)
                continue
            raise


def _extract_token(authorization: Optional[str]) -> str:
    v = (authorization or "").strip()
    if not v:
        return ""
    parts = v.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return v


def require_admin(
    x_api_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Require a matching admin token when OFF_MARKET_ADMIN_TOKEN is set.
    If the env var is empty, the check is skipped (useful for local dev).
    """
    provided = (x_api_key or "").strip() or _extract_token(authorization)
    if ADMIN_TOKEN and provided != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return True


# ---------- Schemas ----------
class CreateDealRequest(BaseModel):
    user_id: Optional[str] = None
    title: str = Field(..., min_length=2)
    location: str = Field(..., min_length=2)
    # Canonical DB column is asking_price, but keep price as an accepted alias
    # for backward compatibility.
    asking_price: Optional[float] = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("asking_price", "price"),
    )
    estimated_value: Optional[float] = Field(default=None, ge=0)
    discount_percent: Optional[float] = Field(default=None, ge=0)
    bedrooms: Optional[int] = Field(None, ge=0, le=20)
    bathrooms: Optional[int] = Field(None, ge=0, le=20)
    property_type: Optional[str] = Field(default=None, max_length=80)
    investment_type: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(
        default=None,
        max_length=120,
        validation_alias=AliasChoices("contact_email", "contact"),
    )
    source: Optional[str] = Field("manual", max_length=80)
    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        validation_alias=AliasChoices("notes", "description"),
    )
    lat: Optional[float] = None
    lng: Optional[float] = None

    # Images: accept multiple keys and normalize to storing image_url.
    image_url: Optional[str] = None
    imageurl: Optional[str] = None
    cover_photo_url: Optional[str] = None

    @field_validator("title", "location")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class CreateDealResponse(BaseModel):
    id: str
    title: str
    location: Optional[str] = None
    asking_price: Optional[float] = None
    price: Optional[float] = None
    estimated_value: Optional[float] = None
    discount_percent: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    property_type: Optional[str] = None
    investment_type: Optional[str] = None
    contact_email: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    user_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    score: Optional[int] = None
    imageurl: Optional[str] = None
    image_url: Optional[str] = None


# ---------- Routes ----------
@router.post("/create", response_model=CreateDealResponse, dependencies=[Depends(require_admin)])
def create_off_market_deal(payload: CreateDealRequest):
    """
    Insert a new row into off_market_leads (Supabase-py v2).
    NOTE: In v2, .insert() returns a response directly; there is no .select("*") chain.

    If user_id is omitted, it is stored as NULL (admin flow).
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    chosen_image_url = (
        (payload.image_url or "").strip()
        or (payload.imageurl or "").strip()
        or (payload.cover_photo_url or "").strip()
        or None
    )

    asking_price = payload.asking_price
    estimated_value = payload.estimated_value
    discount_percent = payload.discount_percent
    if discount_percent is None and asking_price and estimated_value and estimated_value > 0:
        discount_percent = ((estimated_value - asking_price) / estimated_value) * 100

    score = compute_off_market_score(
        asking_price=asking_price,
        estimated_value=estimated_value,
        discount_percent=discount_percent,
        bedrooms=payload.bedrooms,
        location=payload.location,
    )

    # Keep backward compatible columns in sync when present in DB.
    data = {
        "user_id": payload.user_id,
        "title": payload.title,
        "location": payload.location,
        "investment_type": payload.investment_type,
        "asking_price": asking_price,
        "price": asking_price,
        "estimated_value": estimated_value,
        "discount_percent": discount_percent,
        "bedrooms": payload.bedrooms,
        "bathrooms": payload.bathrooms,
        "property_type": payload.property_type,
        "contact_email": payload.contact_email,
        "contact": payload.contact_email,
        "source": (payload.source or "manual").strip().lower(),
        "notes": payload.notes,
        "lat": payload.lat,
        "lng": payload.lng,
        "score": score,
        "image_url": chosen_image_url,
        "imageurl": chosen_image_url,
    }
    try:
        inserted = _insert_with_schema_fallback(OFF_MARKET_TABLE, [data])
        if not inserted:
            raise HTTPException(status_code=502, detail="Insert failed")
        return CreateDealResponse(**inserted[0])
    except Exception as e:
        logger.exception("Failed to create off-market deal")
        raise HTTPException(status_code=500, detail="Failed to create deal") from e


# ✅ simple generator endpoint (guard against zero/negative count)
class GenerateRequest(BaseModel):
    location: str
    budget: float
    count: int = 5
    investment_type: Optional[str] = None
    user_id: Optional[str] = None

    @field_validator("count")
    @classmethod
    def clamp_count(cls, v: int) -> int:
        try:
            iv = int(v)
        except Exception:
            iv = 5
        return max(1, min(10, iv))


@router.post("/generate-off-market")
async def generate_off_market(payload: GenerateRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    inv = (payload.investment_type or "").strip() or None

    rows: List[dict] = []
    for i in range(payload.count):
        # Pick a plausible asking_price <= budget with slight randomization.
        max_budget = max(0.0, float(payload.budget))
        base = max_budget * 0.75
        asking_price = max(0.0, min(max_budget, base * random.uniform(0.92, 1.06)))

        estimated_value = asking_price * 1.15 if asking_price else None
        discount_percent = (
            round(((estimated_value - asking_price) / estimated_value) * 100, 1)
            if estimated_value and estimated_value > 0 and asking_price is not None
            else None
        )

        bedrooms = random.choice([None, 2, 3, 4])
        bathrooms = random.choice([None, 1, 2])

        score = compute_off_market_score(
            asking_price=asking_price,
            estimated_value=estimated_value,
            discount_percent=discount_percent,
            bedrooms=bedrooms,
            location=payload.location,
        )

        rows.append(
            {
                "user_id": payload.user_id,
                "title": "Off-market opportunity",
                "location": payload.location,
                "investment_type": inv,
                "asking_price": asking_price,
                "price": asking_price,
                "estimated_value": estimated_value,
                "discount_percent": discount_percent,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "source": "generated",
                "notes": "Generated placeholder lead",
                "score": score,
                "image_url": None,
                "imageurl": None,
            }
        )

    try:
        inserted = _insert_with_schema_fallback(OFF_MARKET_TABLE, rows)
        # New shape: leads. Keep deals for backward compatibility.
        return {"leads": inserted, "deals": inserted}
    except Exception as e:
        logger.exception("Failed to generate off-market leads")
        raise HTTPException(status_code=500, detail="Failed to generate deals") from e


SortParam = Literal["score_desc", "created_at_desc"]


@router.get("")
def list_off_market_leads(
    limit: int = Query(default=20, ge=1, le=200),
    location: Optional[str] = Query(default=None),
    investment_type: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    sort: SortParam = Query(default="created_at_desc"),
) -> List[dict]:
    """Return newest off-market leads with optional filters."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        base_query = supabase.table(OFF_MARKET_TABLE).select("*")

        def apply_sort(q):
            if sort == "score_desc":
                return q.order("score", desc=True).order("created_at", desc=True)
            return q.order("created_at", desc=True)

        query = apply_sort(base_query)

        if location is not None:
            loc = str(location).strip()
            if loc:
                loc_esc = loc.replace("%", "")
                query = query.or_(f"location.ilike.%{loc_esc}%,address.ilike.%{loc_esc}%")

        if investment_type is not None:
            inv = str(investment_type).strip()
            if inv:
                query = query.ilike("investment_type", f"%{inv}%")

        if min_price is not None:
            query = query.gte("price", min_price)
        if max_price is not None:
            query = query.lte("price", max_price)

        query = query.limit(int(limit))

        try:
            res = query.execute()
        except Exception as exc:
            missing = _missing_column_from_api_error(exc)
            if missing == "score" and sort == "score_desc":
                # Fallback when schema cache doesn't yet include score
                res = base_query.order("created_at", desc=True).limit(int(limit)).execute()
            else:
                raise
        rows = res.data or []
        if not isinstance(rows, list):
            return []
        return [r for r in rows if isinstance(r, dict)]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"off-market list failed: {e}")


@router.get("/{lead_id}")
def get_off_market_lead(lead_id: uuid.UUID) -> dict:
    """Fetch a single off-market lead by id."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        res = (
            supabase.table(OFF_MARKET_TABLE)
            .select("*")
            .eq("id", str(lead_id))
            .maybe_single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Lead not found")
        if isinstance(res.data, dict):
            return res.data
        # Defensive: PostgREST should return a single object from maybe_single().
        return {"data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"off-market fetch failed: {e}")
