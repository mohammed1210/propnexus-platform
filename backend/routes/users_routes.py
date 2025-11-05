# backend/routes/users_routes.py
"""
User management routes - plan and profile info
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from supabase import Client, create_client

router = APIRouter(prefix="/users", tags=["users"])

# --- Environment ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"[users_routes] Could not create Supabase client: {e}")
else:
    print("[users_routes] Supabase not configured; endpoints will return errors.")

USERS_TABLE = "users"
EMAIL_COL = "email"
PLAN_COL = "plan"
STRIPE_CUSTOMER_COL = "stripe_customer_id"


def _get_user_by_email(email: str) -> dict | None:
    """Fetch user record from Supabase by email."""
    if not supabase:
        return None
    try:
        res = (
            supabase.table(USERS_TABLE)
            .select("*")
            .eq(EMAIL_COL, email)
            .maybe_single()
            .execute()
        )
        if res and hasattr(res, "data"):
            if isinstance(res.data, dict):
                return res.data
            elif isinstance(res.data, list) and res.data:
                return res.data[0]
        return None
    except Exception as e:
        print(f"[users_routes] Error fetching user {email}: {e}")
        return None


@router.get("/plan")
async def get_user_plan(authorization: str = Header(None)):
    """
    GET /users/plan
    
    Returns the user's current plan and stripe_customer_id.
    
    Expected header: Authorization: Bearer <supabase_jwt>
    
    Returns:
      {
        "plan": "free" | "pro" | "enterprise",
        "stripe_customer_id": "cus_xxx" | null,
        "email": "user@example.com"
      }
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Extract JWT token from Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")
    
    # Verify the token with Supabase Auth
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_email = user_response.user.email
        if not user_email:
            raise HTTPException(status_code=401, detail="No email in token")
    except Exception as e:
        print(f"[users_routes] Auth verification failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Fetch user record
    user_record = _get_user_by_email(user_email)
    if not user_record:
        # User authenticated but no record in users table - return defaults
        return JSONResponse({
            "email": user_email,
            "plan": "free",
            "stripe_customer_id": None,
        })
    
    plan = user_record.get(PLAN_COL, "free")
    stripe_customer_id = user_record.get(STRIPE_CUSTOMER_COL)
    
    return JSONResponse({
        "email": user_email,
        "plan": plan,
        "stripe_customer_id": stripe_customer_id,
    })
