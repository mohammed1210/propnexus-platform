# backend/routes/users_routes.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import os
from supabase import create_client, Client
from typing import Optional

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
async def get_user_plan(email: str = Query(..., description="User email address")):
    """
    Get user plan information from Supabase users table.
    
    Query params:
    - email: User email address (required)
    
    Returns:
    - plan: Subscription plan (free, pro, investor)
    - stripe_customer_id: Stripe customer ID
    """
    if not email:
        raise HTTPException(status_code=400, detail="Missing email parameter")
    
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
            .eq(EMAIL_COL, email)
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
