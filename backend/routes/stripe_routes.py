from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import stripe
from supabase import create_client

router = APIRouter(prefix="/stripe", tags=["stripe"])

# Do not create Supabase client at import time (tests patch sb)
sb = None  # tests patch backend.routes.stripe_routes.sb
# The stripe module itself is patched by tests

class CheckoutRequest(BaseModel):
    email: str
    price_id: str

class PortalRequest(BaseModel):
    email: str

def _get_supabase():
    url = os.getenv("SUPABASE_URL") or "http://localhost"
    key = os.getenv("SUPABASE_KEY") or "anon"
    return create_client(url, key)

def _frontend_url() -> str:
    return (
        os.getenv("FRONTEND_URL")
        or os.getenv("NEXT_PUBLIC_SITE_URL")
        or "http://localhost:3000"
    )

@router.post("/create-checkout-session")
def create_checkout_session(payload: CheckoutRequest):
    """
    Creates a Stripe Checkout Session with a 7-day trial.
    Tests mock stripe + sb, so this must not hard-fail on missing env.
    """
    try:
        global sb
        if sb is None:
            sb = _get_supabase()

        # If a secret key exists, set it (safe in prod). If not, tests still work due to stripe mock.
        secret = os.getenv("STRIPE_SECRET_KEY")
        if secret:
            stripe.api_key = secret

        email = str(payload.email).lower().strip()
        price_id = payload.price_id

        # 1) Find existing customer in Stripe (mocked in tests)
        existing = stripe.Customer.search(query=f"email:'{email}'")
        if getattr(existing, "data", None):
            customer_id = existing.data[0].id
        else:
            customer = stripe.Customer.create(email=email)
            customer_id = customer.id

        # 2) Persist/Upsert customer mapping in Supabase (mocked in tests)
        try:
            sb.table("stripe_customers").upsert(
                {"email": email, "stripe_customer_id": customer_id},
                on_conflict="email",
            ).execute()
        except Exception:
            pass  # don't block checkout if db table isn't present

        base = _frontend_url().rstrip("/")
        success_url = os.getenv("STRIPE_SUCCESS_URL") or f"{base}/success"
        cancel_url = os.getenv("STRIPE_CANCEL_URL") or f"{base}/pricing"

        # 3) Create checkout session WITH 7 day trial (tests expect subscription_data.trial_period_days)
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={"trial_period_days": 7},
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            allow_promotion_codes=True,
        )

        return {"url": session.url}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"create checkout session failed: {e}")

@router.post("/create-portal-session")
def create_portal_session(payload: PortalRequest):
    """
    Creates a Stripe billing portal session.
    """
    try:
        global sb
        if sb is None:
            sb = _get_supabase()

        secret = os.getenv("STRIPE_SECRET_KEY")
        if secret:
            stripe.api_key = secret

        email = str(payload.email).lower().strip()

        # Try to find customer id in Supabase first
        customer_id: Optional[str] = None
        try:
            rec = (
                sb.table("stripe_customers")
                .select("stripe_customer_id")
                .eq("email", email)
                .maybe_single()
                .execute()
            )
            if rec.data and rec.data.get("stripe_customer_id"):
                customer_id = rec.data["stripe_customer_id"]
        except Exception:
            customer_id = None

        # Fallback to Stripe search
        if not customer_id:
            existing = stripe.Customer.search(query=f"email:'{email}'")
            if getattr(existing, "data", None):
                customer_id = existing.data[0].id

        if not customer_id:
            raise HTTPException(status_code=404, detail="No Stripe customer found for this email")

        base = _frontend_url().rstrip("/")
        return_url = os.getenv("STRIPE_PORTAL_RETURN_URL") or f"{base}/account"

        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

        return {"url": portal.url}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"create portal session failed: {e}")
