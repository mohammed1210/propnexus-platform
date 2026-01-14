# backend/routes/payments_routes.py
import os

import stripe
from fastapi import APIRouter, HTTPException, Request

from backend.utils.emailer import send_magic_email
from backend.utils.jwt_utils import make_magic_token
from backend.utils.supabase_client import get_supabase

supabase = get_supabase()

router = APIRouter(prefix="/payments", tags=["payments"])

# NOTE: These secrets are captured at import time.
# For better test reliability (allowing env var changes without module reload),
# consider refactoring to retrieve these per-request like in stripe_webhook.py
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
APP_BASE = os.getenv("NEXT_PUBLIC_APP_BASE_URL", "http://localhost:3000")


@router.post("/stripe/webhook")
async def stripe_webhook(req: Request):
    payload = await req.body()
    sig = req.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] in ("checkout.session.completed", "invoice.paid"):
        data = event["data"]["object"]
        email = (data.get("customer_details") or {}).get("email") or data.get("customer_email")
        if email:
            # Upsert subscription/tier (if Supabase configured)
            if supabase:
                supabase.table("users").upsert({"email": email, "tier": "pro"}).execute()
            # Issue magic link
            token = make_magic_token(email, tier="pro")
            url = f"{APP_BASE}/auth/magic/verify?token={token}"
            await send_magic_email(email, url)
    return {"ok": True}


# Optional: manual magic issue (e.g., resend)
@router.post("/magic/issue")
async def issue_magic(email: str):
    token = make_magic_token(email, tier="pro")
    url = f"{APP_BASE}/auth/magic/verify?token={token}"
    await send_magic_email(email, url)
    return {"sent": True}
