# backend/routes/stripe_routes.py
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import os
import stripe
from supabase import create_client, Client

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- ENV ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SITE_URL = (
    os.getenv("SITE_URL")
    or os.getenv("NEXT_PUBLIC_SITE_URL")
    or "https://propnexus-platform.vercel.app"
)
PORTAL_RETURN_URL = os.getenv("PORTAL_RETURN_URL") or SITE_URL

stripe.api_key = STRIPE_SECRET_KEY

# Try to import a stable Stripe error class across SDK versions
try:
    from stripe.error import StripeError as StripeLibError  # normal path
except Exception:  # pragma: no cover
    try:
        from stripe._error import StripeError as StripeLibError  # fallback on some builds
    except Exception:

        class StripeLibError(Exception):
            """Fallback exception class for Stripe errors.

            Used when Stripe library imports fail or are unavailable.
            This ensures the module can still be imported in test environments.
            """

            pass


# Optional Supabase client (best-effort only)
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
    """
    1) Try users.stripe_customer_id in Supabase (if configured)
    2) Try to find customer in Stripe
    3) Create new Stripe customer
    4) Upsert back to Supabase (best-effort)
    """
    customer_id = None

    # 1) Supabase lookup
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
            pass  # fall through to Stripe

    # 2) Search in Stripe
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

    # 3) Create if missing
    if not customer_id:
        created = stripe.Customer.create(email=email)
        customer_id = created.id

    # 4) Upsert to Supabase
    if sb:
        try:
            sb.table(USERS_TABLE).upsert(
                {EMAIL_COL: email, CUST_COL: customer_id},
                on_conflict=EMAIL_COL,
            ).execute()
        except Exception:
            pass

    return customer_id


@router.post("/create-portal-session")
async def create_portal_session(req: Request):
    """
    Creates a Stripe Billing Portal session for the given email.
    Body: { "email": "user@example.com" }
    """
    try:
        body = await req.json()
    except Exception:
        body = {}

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
    except StripeLibError as e:
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=502, detail=f"Stripe error: {msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-checkout-session")
async def create_checkout_session(req: Request):
    """
    Creates a Stripe Checkout session for a subscription.
    Body: { "email": "user@example.com", "price_id": "price_xxx" }
    """
    try:
        body = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    email = body.get("email")
    price_id = body.get("price_id")

    if not email or not price_id:
        raise HTTPException(status_code=400, detail="Missing email or price_id")

    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    try:
        customer_id = get_or_create_customer(email)
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{SITE_URL}/account?success=true",
            cancel_url=f"{SITE_URL}/pricing?canceled=true",
        )
        return JSONResponse({"url": session.url})
    except StripeLibError as e:
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=502, detail=f"Stripe error: {msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
