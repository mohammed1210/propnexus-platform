# backend/routes/stripe_routes.py
from __future__ import annotations

import json
import logging
import os
from typing import Any

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# ---- Env / Stripe init -------------------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY") or os.getenv("STRIPE_API_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")  # optional in dev

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logging.warning("⚠️ STRIPE_SECRET_KEY not set; /stripe/* endpoints will 400")

router = APIRouter(prefix="/stripe", tags=["stripe"])


# ---- Models ------------------------------------------------------------------
class CheckoutReq(BaseModel):
    email: str | None = None
    success_url: str | None = None
    cancel_url: str | None = None


# ---- Routes ------------------------------------------------------------------
@router.post("/checkout")
async def create_checkout_session(payload: CheckoutReq) -> dict[str, Any]:
    """
    Creates a hosted Stripe Checkout session for a subscription.

    Requires:
      - STRIPE_SECRET_KEY
      - STRIPE_PRICE_ID  (Price in test mode)
    """
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(
            status_code=400,
            detail="Stripe not configured (missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID)",
        )

    try:
        success_url = payload.success_url or os.getenv(
            "STRIPE_SUCCESS_URL", "http://localhost:3000/success"
        )
        cancel_url = payload.cancel_url or os.getenv(
            "STRIPE_CANCEL_URL", "http://localhost:3000/pricing"
        )

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
            customer_email=payload.email,
            allow_promotion_codes=True,
            billing_address_collection="auto",
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            automatic_tax={"enabled": True},
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:  # pragma: no cover
        logging.exception("Stripe checkout error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict[str, str]:
    """
    Handles Stripe webhooks. In dev you can run:
      stripe listen --forward-to localhost:8000/stripe/webhook
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    event = None
    try:
        if STRIPE_WEBHOOK_SECRET and sig:
            event = stripe.Webhook.construct_event(
                payload=payload, sig_header=sig, secret=STRIPE_WEBHOOK_SECRET
            )
        else:
            # Accept unsigned events in dev to keep flow simple
            event = json.loads(payload or "{}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    et = (event or {}).get("type")
    data = (event or {}).get("data", {}).get("object", {})

    # Minimal demo reactions (extend to persist in Supabase, etc.)
    if et == "checkout.session.completed":
        logging.info("💰 Checkout completed: %s", data.get("id"))
    elif et == "customer.subscription.updated":
        logging.info("🔁 Subscription updated: %s", data.get("id"))
    elif et == "customer.subscription.deleted":
        logging.info("❌ Subscription cancelled: %s", data.get("id"))
    else:
        logging.info("ℹ️ Unhandled event: %s", et)

    return {"status": "ok"}
