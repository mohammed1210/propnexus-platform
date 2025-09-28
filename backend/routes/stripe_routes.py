# backend/routes/stripe_routes.py
from __future__ import annotations

import os
from typing import Dict, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- Configuration -------------------------------------------------------------

# Accept a few common env var names; use whatever you already set in Railway
STRIPE_SECRET = (
    os.getenv("STRIPE_SECRET_KEY")
    or os.getenv("STRIPE_API_KEY")
    or os.getenv("STRIPE_SECRET")
)

# Try to import Stripe only if a secret is present
stripe = None  # type: ignore
if STRIPE_SECRET:
    try:
        import stripe as _stripe  # type: ignore

        _stripe.api_key = STRIPE_SECRET
        stripe = _stripe
    except Exception:
        # If the library isn’t installed, treat as not configured
        stripe = None

# Import billing helpers with package-relative path; if missing, we’ll gate at runtime
_get_entitlement = None
_upsert_subscription = None
try:
    from ..utils.billing import (
        get_entitlement_by_email as _get_entitlement,  # type: ignore; returns customer's entitlement
    )
    from ..utils.billing import (
        upsert_subscription as _upsert_subscription,  # persists sub state to DB
    )
except Exception:
    _get_entitlement = None
    _upsert_subscription = None


# --- Models --------------------------------------------------------------------


class CheckoutPayload(BaseModel):
    email: str = Field(..., description="Customer email")
    price_id: str = Field(..., description="Stripe Price ID")
    success_url: str = Field(..., description="URL to send user after success")
    cancel_url: str = Field(..., description="URL to send user after cancel")


class PortalPayload(BaseModel):
    customer_id: str = Field(..., description="Stripe Customer ID")
    return_url: str = Field(..., description="Return URL after portal exit")


class OkResponse(BaseModel):
    ok: Literal[True] = True


# --- Guards --------------------------------------------------------------------


def require_stripe() -> None:
    if not STRIPE_SECRET or stripe is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe not configured on server (missing STRIPE_SECRET_KEY or library).",
        )


def require_billing_helpers() -> None:
    if _get_entitlement is None or _upsert_subscription is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing helpers not available (..utils.billing).",
        )


# --- Endpoints -----------------------------------------------------------------


@router.post("/create-checkout-session")
def create_checkout_session(body: CheckoutPayload) -> Dict[str, str]:
    """
    Create a subscription Checkout Session. Returns the hosted session URL.
    """
    require_stripe()

    # Optional: ensure the email is allowed / not already fully entitled
    if _get_entitlement:
        try:
            _ = _get_entitlement(body.email)  # you can use this to gate/annotate
        except Exception:
            # If your helper raises, you can still allow checkout; do not hard fail.
            pass

    try:
        session = stripe.checkout.Session.create(  # type: ignore[attr-defined]
            mode="subscription",
            line_items=[{"price": body.price_id, "quantity": 1}],
            customer_email=body.email,
            success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=body.cancel_url,
            allow_promotion_codes=True,
            billing_address_collection="auto",
            payment_method_types=["card"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    return {"id": session.get("id", ""), "url": session.get("url", "")}


@router.post("/create-portal-session")
def create_portal_session(body: PortalPayload) -> Dict[str, str]:
    """
    Create a Billing Portal Session so the customer can manage their subscription.
    """
    require_stripe()
    try:
        portal = stripe.billing_portal.Session.create(  # type: ignore[attr-defined]
            customer=body.customer_id,
            return_url=body.return_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    return {"url": portal.get("url", "")}


@router.post("/webhook", response_model=OkResponse)
def webhook() -> OkResponse:
    """
    Minimal webhook handler placeholder. Add signature verification if you enable this.
    We don't fail app startup when Stripe is missing; this route just acknowledges.
    """
    # If you later verify signatures:
    #   endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    #   require_stripe(); verify request body + signature here...
    return OkResponse()
