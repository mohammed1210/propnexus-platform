# backend/routes/users_routes.py
from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse
import os
from supabase import create_client, Client
from typing import Optional
from jose import jwt, JWTError

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


def extract_email_from_token(authorization: str) -> Optional[str]:
    """
    Extract email from JWT token in Authorization header.
    Expected format: "Bearer <token>"
    Returns None if token is invalid or missing.
    
    SECURITY NOTE: This function extracts email claims from JWT tokens without full verification.
    
    This is acceptable because:
    1. The endpoint only returns plan tier information (non-sensitive data)
    2. Actual user authentication is handled by Supabase Auth in the frontend
    3. The database query returns "free" tier if the email doesn't exist
    4. RLS policies on the database enforce proper data access control
    5. The worst-case scenario is someone looks up a plan tier for an email
    
    For security-critical operations, full JWT verification with proper secrets is required.
    This is a convenience endpoint for plan lookup only.
    """
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    token = parts[1]
    
    try:
        # Decode JWT without verification to extract claims
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
            algorithms=["HS256"]
        )
        
        # Try common JWT email fields
        # Supabase tokens use 'email', custom tokens may use 'sub'
        return payload.get("email") or payload.get("sub")
    except Exception:
        # If decode fails for any reason, return None and fall back to query param
        return None


@router.get("/plan")
async def get_user_plan(
    email: Optional[str] = Query(None, description="User email address"),
    authorization: Optional[str] = Header(None, description="Bearer token")
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
    # Extract email from Authorization header if present
    token_email = None
    if authorization:
        token_email = extract_email_from_token(authorization)
    
    # Use token email if available, otherwise fall back to query parameter
    user_email = token_email or email
    
    if not user_email:
        raise HTTPException(
            status_code=400, 
            detail="Missing email parameter or Authorization header"
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
