from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..utils.stripe_utils import construct_event_from_request, create_checkout_session

router = APIRouter(prefix="/stripe", tags=["stripe"])

# ENV (backend)
PRICE_ID_DEFAULT = os.getenv("STRIPE_PRICE_ID", "")
SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "https://propnexus-platform.vercel.app/success")
CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "https://propnexus-platform.vercel.app/billing/cancel")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


@router.post("/checkout")
async def stripe_checkout(req: Request):
    data = await req.json()
    price_id = (data.get("priceId") or PRICE_ID_DEFAULT or "").strip()
    if not price_id:
        raise HTTPException(status_code=400, detail="Missing priceId")
    email = (data.get("email") or "").strip() or None
    session = create_checkout_session(price_id, SUCCESS_URL, CANCEL_URL, email)
    return JSONResponse(session)


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = construct_event_from_request(payload, sig_header, WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    etype = event.get("type")

    # --- Subscription & payment sync logic ---
    if etype in {"checkout.session.completed", "invoice.payment_succeeded"}:
        # TODO: lookup the Supabase user via customer_email
        # then upsert subscription status ("active"/"trialing"/"canceled")
        pass

    elif etype == "customer.subscription.updated":
        # TODO: update tier or expiry based on subscription changes
        pass

    elif etype == "customer.subscription.deleted":
        # TODO: mark user as downgraded/free
        pass

    return JSONResponse({"ok": True})
