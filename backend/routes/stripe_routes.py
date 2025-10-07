# Package-first utils.billing import with fallback
try:
    from backend.utils.billing import get_entitlement_by_email, upsert_subscription
except Exception:
    from .utils.billing import get_entitlement_by_email, upsert_subscription
# (fallback to relative)
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

router = APIRouter()
log = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

class CheckoutPayload(BaseModel):
    price_id: str
    customer_email: str
    mode: str = "subscription"
    metadata: dict | None = None

class PortalPayload(BaseModel):
    customer_id: str

@router.post("/stripe/create-checkout-session")
def create_checkout_session(body: CheckoutRequest):
    if not stripe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe not configured on server",
        )

    try:
        session = stripe.checkout.Session.create(
            mode=body.mode,
            line_items=[{"price": body.price_id, "quantity": 1}],
            customer_email=body.customer_email,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            allow_promotion_codes=True,
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:
        log.exception("create_checkout_session failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stripe/create-portal-session")
def create_portal_session(body: PortalRequest):
    if not stripe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe not configured on server",
        )

    try:
        session = stripe.billing_portal.Session.create(
            customer=body.customer_id, return_url=body.return_url
        )
        return {"url": session.url}
    except Exception as e:
        log.exception("create_portal_session failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/entitlement")
def get_entitlement(email: str = Query(...)):
    return get_entitlement_by_email(email)

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """
    Optional: If no Stripe, accept and no-op to keep the app healthy.
    If Stripe is configured, validate signature and handle events.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if not stripe or not STRIPE_WEBHOOK_SECRET:
        # Accept to avoid retries hammering the service in non-Stripe envs
        return {"ok": True, "skipped": True}

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)  # type: ignore
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook error: {exc}") from exc

    # Handle events you care about; keep minimal and resilient by default
    if event["type"] == "checkout.session.completed":
        obj = event["data"]["object"]
    email = obj.get("customer_details", {}).get("email")
    stripe_customer_id = obj.get("customer")
    subscription = obj

    if email and stripe_customer_id:
        try:
            upsert_subscription(email, stripe_customer_id, subscription)
        except Exception as e:
            print(f"⚠️ Failed to upsert subscription: {e}")

    return {"received": True}