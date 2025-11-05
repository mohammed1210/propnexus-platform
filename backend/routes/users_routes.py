from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import os
from supabase import create_client

router = APIRouter(prefix="/users", tags=["users"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
USERS_TABLE = os.getenv("USERS_TABLE","users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL","email")
PLAN_COL = os.getenv("USERS_PLAN_COL","plan")
CUST_COL = os.getenv("USERS_STRIPE_COL","stripe_customer_id")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

@router.get("/plan")
def get_plan(email: str):
    try:
        r = sb.table(USERS_TABLE).select(f"{PLAN_COL},{CUST_COL}").eq(EMAIL_COL, email).maybe_single().execute()
        data = r.data or {}
        return JSONResponse({"plan": data.get(PLAN_COL, "free"), "stripe_customer_id": data.get(CUST_COL)})
    except Exception as e:
        raise HTTPException(500, str(e)).
