# backend/routes/users_routes.py
from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse
import os
from supabase import create_client, Client
from typing import Optional
from ..utils.supabase_jwt import verify_supabase_token, extract_bearer_token

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


@router.get("/plan")
async def get_user_plan(
    email: Optional[str] = Query(None, description="User email address (optional if using Authorization header)"),
    authorization: Optional[str] = Header(None)
):
    """
    Get user plan information from Supabase users table.
    
    Supports two authentication methods:
    1. Query parameter: ?email=user@example.com
    2. Authorization header: Bearer <supabase_jwt_token>
    
    If both are provided, email parameter takes precedence.
    If neither is provided, returns 401 Unauthorized.
    
    Returns:
    - plan: Subscription plan (free, pro, investor)
    - stripe_customer_id: Stripe customer ID
    """
    user_email = None
    
    # Method 1: Check if email query parameter is provided
    # Note: Email parameter takes precedence for backward compatibility with existing clients
    # This allows gradual migration to token-based auth
    if email:
        user_email = email
    # Method 2: Check Authorization header for JWT token
    elif authorization:
        token = extract_bearer_token(authorization)
        if token:
            payload = verify_supabase_token(token)
            if payload and "email" in payload:
                user_email = payload["email"]
            else:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired token"
                )
        else:
            raise HTTPException(
                status_code=401,
                detail="Invalid Authorization header format. Expected: Bearer <token>"
            )
    else:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication. Provide either email query parameter or Authorization header."
        )
    
    if not sb:
        raise HTTPException(
            status_code=500, 
            detail="Supabase not configured on server"
        )
    
    try:
        # Query the users table for the given email
        res = (
            sb.table(USERS_TABLE)
            .select("*")
            .eq(EMAIL_COL, user_email)
            .maybe_single()
            .execute()
        )
        
        # Extract row data
        row = None
        if res and hasattr(res, "data"):
            if isinstance(res.data, dict):
                row = res.data
            elif isinstance(res.data, list) and res.data:
                row = res.data[0]
        
        # If user not found, return default free plan
        if not row:
            return JSONResponse({
                "plan": "free",
                "stripe_customer_id": None
            })
        
        # Return plan and customer ID
        return JSONResponse({
            "plan": row.get(PLAN_COL, "free"),
            "stripe_customer_id": row.get(CUST_COL)
        })
        
    except Exception as e:
        # Log error but return free plan as fallback
        print(f"[users_routes] Error fetching user plan: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user plan: {str(e)}"
        )
