# backend/routes/stripe_routes.py
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import os, stripe
from supabase import create_client, Client

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- ENV ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")  # sk_test_... or sk_live_...
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SITE_URL = os.getenv("SITE_URL") or os.getenv("NEXT_PUBLIC_SITE_URL") or "https://propnexus-platform.vercel.app"
PORTAL_RETURN_URL = os.getenv("PORTAL_RETURN_URL") or SITE_URL

stripe.api_key = STRIPE_SECRET_KEY
sb: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")

def get_or_create_customer(email: str) -> str:
    """
    1) Try Supabase users.{stripe_customer_id}
    2) Try search in Stripe
    3) Create new Stripe customer
    4) Persist customer id back to Supabase
    """
    customer_id = None

    if sb:
        res = sb.table(USERS_TABLE).select("*").eq(EMAIL_COL, email).maybe_single().execute()
        row = (res.data or {}) if isinstance(res.data, dict) else (res.data[0] if res.data else None)
        if row and row.get(CUST_COL):
            return row[CUST_COL]

    # 2) Stripe search (safe: returns only test or live depending on key)
    try:
        found = stripe.Customer.search(query=f"email:'{email}'", limit=1)
        if found.data:
            customer_id = found.data[0].id
    except Exception:
        # Some accounts may not have search enabled; fall back to list
        customers = stripe.Customer.list(email=email, limit=1)
        if customers.data:
            customer_id = customers.data[0].id

    # 3) Create if still missing
    if not customer_id:
        created = stripe.Customer.create(email=email)
        customer_id = created.id

    # 4) Upsert to Supabase for future calls
    if sb:
        try:
            sb.table(USERS_TABLE).upsert(
                {EMAIL_COL: email, CUST_COL: customer_id},
                on_conflict=EMAIL_COL
            ).execute()
        except Exception:
            pass

    return customer_id

@router.post("/create-portal-session")
async def create_portal_session(req: Request):
    body = await req.json()
    email = (body or {}).get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Missing email")

    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        customer_id = get_or_create_customer(email)
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=PORTAL_RETURN_URL,
        )
        return JSONResponse({"url": session.url})
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    