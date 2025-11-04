# backend/routes/stripe_routes.py
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import os, stripe
from supabase import create_client, Client

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- ENV ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SITE_URL = os.getenv("SITE_URL") or os.getenv("NEXT_PUBLIC_SITE_URL") or "https://propnexus-platform.vercel.app"
PORTAL_RETURN_URL = os.getenv("PORTAL_RETURN_URL") or SITE_URL

stripe.api_key = STRIPE_SECRET_KEY

sb: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        sb = None  # continue without SB upsert if misconfigured

USERS_TABLE = os.getenv("USERS_TABLE", "users")
EMAIL_COL = os.getenv("USERS_EMAIL_COL", "email")
CUST_COL = os.getenv("USERS_STRIPE_COL", "stripe_customer_id")

def get_or_create_customer(email: str) -> str:
    customer_id = None

    # (1) Try Supabase
    if sb:
        try:
            res = sb.table(USERS_TABLE).select("*").eq(EMAIL_COL, email).maybe_single().execute()
            row = None
            if res and hasattr(res, "data"):
                if isinstance(res.data, dict):
                    row = res.data
                elif isinstance(res.data, list) and res.data:
                    row = res.data[0]
            if row and row.get(CUST_COL):
                return row[CUST_COL]
        except Exception:
            pass  # fall through

    # (2) Try Stripe search/list
    try:
        found = stripe.Customer.search(query=f"email:'{email}'", limit=1)
        if found.data:
            customer_id = found.data[0].id
    except Exception:
        try:
            customers = stripe.Customer.list(email=email, limit=1)
            if customers.data:
                customer_id = customers.data[0].id
        except Exception:
            pass

    # (3) Create customer if still missing
    if not customer_id:
        created = stripe.Customer.create(email=email)
        customer_id = created.id

    # (4) Upsert back to Supabase (best-effort)
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
    body = {}
    try:
        body = await req.json()
    except Exception:
        pass

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
    except stripe._error.StripeError as e:  # correct for newer SDKs
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=502, detail=f"Stripe error: {msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    