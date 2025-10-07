from __future__ import annotations

import json
import os
import stripe

from fastapi import APIRouter, HTTPException, Request

# --- Stripe configuration from env (test or live) ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

if not STRIPE_SECRET_KEY:
    # The app can still boot; individual endpoints may raise if missing.
    # Keeping this import-time check quiet avoids crashing the whole API.
    pass
else:
    stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.get("/health")
async def stripe_health():
    """
    Lightweight check that our Stripe server-side config is present.
    Does not reveal secrets.
    """
    return {
        "ok": True,
        "has_secret_key": bool(STRIPE_SECRET_KEY),
        "has_webhook_secret": bool(STRIPE_WEBHOOK_SECRET),
    }


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Verify Stripe webhook signatures and handle selected events.

    Requires:
      - STRIPE_WEBHOOK_SECRET = "whsec_..."
      - STRIPE_SECRET_KEY = "sk_test_..." or "sk_live_..."
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        # Misconfiguration: we can’t verify the payload.
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured")

    try:
        # NOTE: construct_event will raise if the signature is invalid or payload malformed.
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    evt_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    # Handle the events you subscribed to in the Dashboard
    if evt_type == "checkout.session.completed":
        # Example: session contains customer, subscription, etc. in data
        # You can look up products/prices to map to your app tiers.
        session_id = data.get("id")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        # TODO: write entitlements for customer_id/subscription_id in your DB.
        # Keep the handler fast; do heavy work asynchronously if needed.
        print(f"[stripe] checkout.session.completed session={session_id} customer={customer_id} sub={subscription_id}")

    elif evt_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        sub_id = data.get("id")
        status = data.get("status")
        customer_id = data.get("customer")
        # TODO: upsert subscription status & map to tiers
        print(f"[stripe] subscription event type={evt_type} id={sub_id} status={status} customer={customer_id}")

    # Always 2xx if the event was processed/ignored successfully
    return {"received": True}
