from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import os, stripe
from supabase import create_client

router = APIRouter(prefix="/stripe", tags=["stripe"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

stripe.api_key = STRIPE_SECRET_KEY

supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@router.post("/create-portal-session")
async def create_portal_session(request: Request):
    """Creates a Stripe customer portal session for the current user."""
    data = await request.json()
    email = data.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    # Retrieve customer id from Supabase
    resp = supabase.table("users").select("stripe_customer_id").eq("email", email).execute()
    customer_id = None
    if resp.data:
        customer_id = resp.data[0].get("stripe_customer_id")

    if not customer_id:
        raise HTTPException(status_code=404, detail="Customer not found in Supabase")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="https://propnexus-platform.vercel.app/dashboard",  # Adjust if needed
        )
        return JSONResponse({"url": session.url})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    