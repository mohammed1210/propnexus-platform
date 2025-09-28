# backend/routes/stripe_routes.py
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

# Try to import billing helpers without crashing the app if they don't exist
try:
    from ..utils.billing import (  # type: ignore
        get_entitlement_by_email,
        upsert_subscription,
    )
except Exception:
    # Safe fallbacks so the app can boot even if billing utils are absent
    def get_entitlement_by_email(email: str) -> dict:
        return {"email": email, "plan": "free", "active": False}

    def upsert_subscription(*_args, **_kwargs) -> None:
        return None


router = APIRouter()

# Stripe client is optional
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

stripe = None
if STRIPE_SECRET_KEY:
    try:
        import stripe as _stripe  # type: ignore

        _stripe.api_key = STRIPE_SECRET_KEY
        stripe = _stripe
    except Exception:
        stripe = None  # keep booting; routes will 503 if called


class CheckoutRequest(BaseModel):
    price_id: str
    customer_email: Optional[str] = None
    mode: str = "subscription"  # or 'payment'
    success_url: str
    cancel_url: str


class PortalRequest(BaseModel):
    customer_id: str
    return_url: str


@router.get("/me/entitlement")
def me_entitlement(email: str):
    """
    Lightweight helper so the frontend can know what features to show.
    Always returns a JSON object; never crashes the app.
    """
    try:
        return get_entitlement_by_email(email)
    except Exception as exc:
        # Keep this resilient — entitlement is non-critical
        return {"email": email, "plan": "free", "active": False, "error": str(exc)}


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
        return {"id": session["id"], "url": session["url"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stripe error: {exc}") from exc


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
        return {"url": session["url"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stripe error: {exc}") from exc


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
        # Example: upsert/activate subscription here if you want
        obj = event["data"]["object"]
        email = (obj.get("customer_details") or {}).get("email")
        if email:
            try:
                upsert_subscription(email=email, active=True)
            except Exception:
                pass

    return {"ok": True}
