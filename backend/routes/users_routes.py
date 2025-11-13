# backend/routes/users_routes.py
from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse
import os
from supabase import create_client, Client
from typing import Optional
from utils.supabase_jwt import verify_supabase_token, extract_bearer_token

router = APIRouter(prefix="/users", tags=["users"])

# --- ENV ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# Optional Supabase client
sb: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        sb = None

USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
PLAN_COL = os.getenv("USERS_PLAN_COL", "plan")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")


def _resolve_email(email_param: Optional[str], authorization: Optional[str]) -> Optional[str]:
    """Resolve user email using precedence: query param > Authorization header.

    Returns email string or raises HTTPException for malformed/invalid auth.
    """
    # 1) Query param takes precedence if provided
    if email_param:
        return email_param

    # 2) Fallback to Authorization header (Bearer token)
    if authorization:
        token = extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")

        payload = verify_supabase_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        return payload.get("email") or payload.get("sub")

    # 3) Neither provided
    raise HTTPException(status_code=401, detail="Missing authentication")


@router.get("/plan")
async def get_user_plan(
    email: Optional[str] = Query(None, description="User email address"),
    authorization: Optional[str] = Header(None, description="Bearer token"),
):
    """
    Get user plan information from Supabase users table.

    Supports two authentication methods:
    1. Query parameter: ?email=user@example.com
    2. Authorization header: Bearer <jwt-token>

    Priority: Authorization header takes precedence over query parameter.

    Returns:
    - plan: Subscription plan (free, pro, investor)
    - stripe_customer_id: Stripe customer ID
    """
    # Resolve email with expected precedence and error handling
    user_email = _resolve_email(email, authorization)

    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured on server")

    try:
        # Query the users table for the given email
        res = sb.table(USERS_TABLE).select("*").eq(EMAIL_COL, user_email).maybe_single().execute()

        # Extract row data
        row = None
        if res and hasattr(res, "data"):
            if isinstance(res.data, dict):
                row = res.data
            elif isinstance(res.data, list) and res.data:
                row = res.data[0]

        # If user not found, return default free plan
        if not row:
            return JSONResponse({"plan": "free", "stripe_customer_id": None})

        # Return plan and customer ID
        return JSONResponse(
            {"plan": row.get(PLAN_COL, "free"), "stripe_customer_id": row.get(CUST_COL)}
        )

    except Exception as e:
        # Log error but return free plan as fallback
        print(f"[users_routes] Error fetching user plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user plan: {str(e)}")
