# backend/routes/users_routes.py
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from supabase import Client, create_client

from backend.utils.supabase_jwt import extract_bearer_token, verify_supabase_token

router = APIRouter(prefix="/users", tags=["users"])

# --- ENV ---
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
# Prefer service role key; fall back to SUPABASE_KEY only if that's how the env is set
SUPABASE_SERVICE_ROLE_KEY = (
    (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    or (os.getenv("SUPABASE_KEY") or "").strip()
)

USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
PLAN_COL = os.getenv("USERS_PLAN_COL", "plan")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")


def _get_supabase_client() -> Optional[Client]:
    """Create a Supabase client if credentials exist, otherwise return None."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        return None


# Optional Supabase client
sb: Optional[Client] = _get_supabase_client()


def _resolve_email(email_param: Optional[str], authorization: Optional[str]) -> str:
    """
    Resolve user email using precedence: query param > Authorization header.

    - If email query param is provided, use it.
    - Else, if Authorization: Bearer <jwt> exists, verify and extract email/sub.
    - Else, 401.
    """
    # 1) Query param takes precedence if provided
    if email_param:
        return email_param.strip()

    # 2) Fallback to Authorization header (Bearer token)
    if authorization:
        token = extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")

        payload = verify_supabase_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        resolved = (payload.get("email") or payload.get("sub") or "").strip()
        if not resolved:
            raise HTTPException(status_code=401, detail="Token did not contain a usable identity")
        return resolved

    # 3) Neither provided
    raise HTTPException(status_code=401, detail="Missing authentication")


@router.get("/plan")
async def get_user_plan(
    email: Optional[str] = Query(None, description="User email address"),
    authorization: Optional[str] = Header(None, description="Bearer token"),
):
    """
    Get user plan information from Supabase users table.

    Supports two lookup methods:
    1) Query parameter: ?email=user@example.com
    2) Authorization header: Bearer <jwt-token>

    Priority: query param takes precedence over Authorization header.
    """
    user_email = _resolve_email(email, authorization)

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
            {
                "plan": row.get(PLAN_COL, "free"),
                "stripe_customer_id": row.get(CUST_COL),
            }
        )

    except Exception as e:
        # Keep errors explicit in logs, but surface a controlled API error
        print(f"[users_routes] Error fetching user plan for {user_email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user plan")
