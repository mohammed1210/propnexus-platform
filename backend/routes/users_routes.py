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
    """
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    token = parts[1]
    
    try:
        # Decode JWT - try both Supabase JWT and custom JWT
        # First try with Supabase service role key
        if SUPABASE_SERVICE_ROLE_KEY:
            try:
                payload = jwt.decode(
                    token,
                    SUPABASE_SERVICE_ROLE_KEY,
                    algorithms=["HS256"],
                    options={"verify_aud": False}
                )
                # Supabase tokens have email in 'email' field
                return payload.get("email") or payload.get("sub")
            except JWTError:
                pass
        
        # Try with custom JWT_SECRET (for magic links)
        jwt_secret = os.getenv("JWT_SECRET", "CHANGE_ME")
        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            # Custom tokens have email in 'sub' field
            return payload.get("sub") or payload.get("email")
        except JWTError:
            pass
        
        # If both fail, return None
        return None
    except Exception:
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
