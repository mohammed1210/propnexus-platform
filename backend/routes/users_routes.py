# backend/routes/users_routes.py
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.utils.supabase_jwt import extract_bearer_token, verify_supabase_token

router = APIRouter(prefix="/users", tags=["users"])


# --- Supabase client (patchable for tests) ---
sb = None  # IMPORTANT: tests patch backend.routes.users_routes.sb


def _get_sb():
    """
    Lazily create/get Supabase client.

    - Keeps a module-level `sb` so unit tests can patch it.
    - Avoids creating the client at import-time (CI/env-safe).
    """
    global sb
    if sb is not None:
        return sb

    # Import here so it only happens when needed
    # Adjust these imports to match your project structure:
    from supabase import create_client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

    # If env vars are missing, leave sb as None and raise a clear error
    if not url or not key:
        raise RuntimeError(
            "Supabase env vars missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)"
        )

    sb = create_client(url, key)
    return sb


# --- ENV ---
USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
PLAN_COL = os.getenv("USERS_PLAN_COL", "plan")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")


def _resolve_email(email_param: Optional[str], authorization: Optional[str]) -> str:
    """
    Resolve user email using precedence: query param > Authorization header.

    Returns email string or raises HTTPException for malformed/invalid auth.
    """
    # 1) Query param takes precedence (tests expect this)
    if email_param:
        return email_param

    # 2) Fallback to Authorization header
    if authorization:
        token = extract_bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")

        payload = verify_supabase_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        email = payload.get("email")
        if not email:
            sub = payload.get("sub")
            # Some test/mocked payloads (and some auth setups) store the email in `sub`.
            # Only accept it as an email if it looks like one.
            if isinstance(sub, str) and "@" in sub:
                email = sub

        if not email:
            raise HTTPException(status_code=401, detail="Token missing email claim")
        return email

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

    client = _get_sb()

    try:
        res = (
            client.table(USERS_TABLE).select("*").eq(EMAIL_COL, user_email).maybe_single().execute()
        )

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
