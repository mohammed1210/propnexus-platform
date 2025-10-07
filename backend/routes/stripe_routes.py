# Package-first utils.billing import with fallback
try:
    from backend.utils.billing import get_entitlement_by_email, upsert_subscription
except Exception:
    from .utils.billing import get_entitlement_by_email, upsert_subscription
# (fallback to relative)
import json
import logging
import os

import stripe
from fastapi import APIRouter, HTTPException, Query, Request
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
def create_checkout_session(payload: CheckoutPayload):
    try:
        session = stripe.checkout.Session.create(
            mode=payload.mode,
            line_items=[{"price": payload.price_id, "quantity": 1}],
            customer_email=payload.customer_email,
            success_url=f"{FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/billing/cancel",
            metadata=payload.metadata or {},
            allow_promotion_codes=True,
        )
        return {"id": session.id, "url": session.url}
    except Exception as e:
        log.exception("create_checkout_session failed")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stripe/create-portal-session")
def create_portal_session(payload: PortalPayload):
    try:
        session = stripe.billing_portal.Session.create(
            customer=payload.customer_id,
            return_url=f"{FRONTEND_URL}/account",
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
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = json.loads(payload)
    except Exception as e:
        log.warning("Webhook signature verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid payload")

    t = event["type"]
    data = event["data"]["object"]

    try:
        if t == "checkout.session.completed":
            customer_id = data.get("customer")
            email = (data.get("customer_details") or {}).get("email")
            subscription_id = data.get("subscription")
            if subscription_id and customer_id and email:
                sub = stripe.Subscription.retrieve(subscription_id)
                upsert_subscription(
                    email=email, stripe_customer_id=customer_id, subscription=sub
                )

        elif t in ("customer.subscription.created", "customer.subscription.updated"):
            sub = data
            customer_id = sub.get("customer")
            customer = stripe.Customer.retrieve(customer_id) if customer_id else None
            email = customer.email if customer else None
            if email and customer_id:
                upsert_subscription(
                    email=email, stripe_customer_id=customer_id, subscription=sub
                )

        elif t == "customer.subscription.deleted":
            sub = data
            customer_id = sub.get("customer")
            customer = stripe.Customer.retrieve(customer_id) if customer_id else None
            email = customer.email if customer else None
            if email and customer_id:
                upsert_subscription(
                    email=email, stripe_customer_id=customer_id, subscription=sub
                )

    except Exception:
        log.exception("Failed to upsert subscription from webhook")
        return {"received": True, "warning": "upsert failed"}

    return {"received": True}