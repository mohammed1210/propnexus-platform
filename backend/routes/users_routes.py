# backend/routes/users_routes.py
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.utils.supabase_jwt import extract_bearer_token, verify_supabase_token
from supabase import Client, create_client

router = APIRouter(prefix="/users", tags=["users"])

# --- ENV ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
PLAN_COL = os.getenv("USERS_PLAN_COL", "plan")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")


# Allow tests to monkeypatch this symbol if needed
supabase: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """
    Lazy Supabase client acquisition.

    - If tests monkeypatch the module-level `supabase`, use it.
    - Otherwise, attempt to create a real client from env vars.
    - Return None if not configured.
    """
    global supabase

    if supabase is not None:
        return supabase

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None

    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        return None


def _resolve_email(email_param: Optional[str], authorization: Optional[str]) -> str:
    """
    Resolve user email using precedence: Authorization header > query param.

    Returns email string or raises HTTPException for malformed/invalid auth.
    """
    # 1) Authorization header takes precedence
    if authorization:
        token = extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")

        payload = verify_supabase_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        email = payload.get("email")
        if not email:
            # We only support email-based lookups for plans
            raise HTTPException(status_code=401, detail="Token missing email claim")
        return email

    # 2) Fallback to query param
    if email_param:
        return email_param

    raise HTTPException(status_code=401, detail="Missing authentication")


@router.get("/plan")
async def get_user_plan(
    email: Optional[str] = Query(None, description="User email address"),
    authorization: Optional[str] = Header(None, description="Bearer token"),
):
    """
    Get user plan information from Supabase users table.

    Supports two authentication methods:
    1) Authorization header: Bearer <jwt-token>  (preferred)
    2) Query parameter: ?email=user@example.com

    Priority: Authorization header takes precedence.

    Returns:
    - plan: Subscription plan (free, pro, investor)
    - stripe_customer_id: Stripe customer ID
    """
    user_email = _resolve_email(email, authorization)

    sb = get_supabase_client()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured on server")

    try:
        res = sb.table(USERS_TABLE).select("*").eq(EMAIL_COL, user_email).maybe_single().execute()

        row = None
        if res and hasattr(res, "data"):
            if isinstance(res.data, dict):
                row = res.data
            elif isinstance(res.data, list) and res.data:
                row = res.data[0]

        if not row:
            return JSONResponse({"plan": "free", "stripe_customer_id": None})

        return JSONResponse(
            {"plan": row.get(PLAN_COL, "free"), "stripe_customer_id": row.get(CUST_COL)}
        )

    except Exception as e:
        print(f"[users_routes] Error fetching user plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user plan: {e}")
