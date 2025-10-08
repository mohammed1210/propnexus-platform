from __future__ import annotations
import os
import stripe
from fastapi import APIRouter, HTTPException, Request

# --- Stripe configuration from environment ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    # Keep quiet if missing; some endpoints may still load
    print("⚠️ STRIPE_SECRET_KEY not set — Stripe client calls may fail.")

router = APIRouter(prefix="/stripe", tags=["Stripe"])


@router.get("/health")
async def stripe_health():
    """Lightweight health check to confirm Stripe config presence."""
    return {
        "ok": True,
        "has_secret_key": bool(STRIPE_SECRET_KEY),
        "has_webhook_secret": bool(STRIPE_WEBHOOK_SECRET),
    }


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Verify Stripe webhook signatures and handle key events.
    Requires:
      - STRIPE_WEBHOOK_SECRET = 'whsec_...'
      - STRIPE_SECRET_KEY = 'sk_test_...' or 'sk_live_...'
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Stripe webhook secret not configured on server",
        )

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {exc}")
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {exc}")

    evt_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    # === Handle key Stripe events ===
    if evt_type == "checkout.session.completed":
        session_id = data.get("id")
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        print(
            f"[stripe] checkout.session.completed "
            f"session={session_id} customer={customer_id} sub={subscription_id}"
        )
        # TODO: update your DB entitlements or trigger async worker here

    elif evt_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        sub_id = data.get("id")
        status = data.get("status")
        customer_id = data.get("customer")
        print(
            f"[stripe] subscription event type={evt_type} "
            f"id={sub_id} status={status} customer={customer_id}"
        )
        # TODO: upsert subscription status in DB

    # Always acknowledge the event
    return {"received": True}
