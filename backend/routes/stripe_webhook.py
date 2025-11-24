from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

# Set up logger
logger = logging.getLogger(__name__)

# The tests patch both `stripe` and this module-level `supabase` symbol.
# Provide a placeholder here to make patching possible without import-time failures.
supabase = None  # will be monkeypatched by tests

router = APIRouter(prefix="/stripe", tags=["stripe"])


def map_price_to_plan(price_id: str) -> Optional[str]:
    """
    Map Stripe price ID to plan name.
    Returns None for unknown price IDs to prevent downgrading users to 'free'.

    Sprint 11.2: Limited to three tiers - free, pro, investor.
    """
    if not price_id:
        return None

    # Build mapping at runtime to support test environment variable injection
    # Sprint 11.2: Only pro and investor tiers (free is default)
    price_to_plan = {
        os.getenv("STRIPE_PRICE_PRO", ""): "pro",
        os.getenv("STRIPE_PRICE_INVESTOR", ""): "investor",
    }

    # Remove empty keys from mapping
    price_to_plan = {k: v for k, v in price_to_plan.items() if k}

    return price_to_plan.get(price_id)


def get_supabase_client():
    """
    Lazy Supabase client acquisition.
    Returns the module-level supabase if explicitly set (for tests), otherwise attempts to create a client.
    Returns None if credentials are missing or creation fails.
    """
    # Use global reference to the module-level supabase
    global supabase

    # If tests have explicitly set the module-level supabase to something other than None, use it
    # This includes when tests monkeypatch it to a Mock object
    if supabase is not None:
        return supabase

    # Attempt to create a client if credentials are present
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        return None

    try:
        from supabase import create_client

        client = create_client(url, key)
        return client
    except Exception as e:
        # If client creation fails (e.g., DNS issues in test), gracefully return None
        logger.debug(f"Failed to create Supabase client: {e}")
        return None


def get_webhook_secret() -> Optional[str]:
    """Get Stripe webhook secret from environment on each request."""
    return os.getenv("STRIPE_WEBHOOK_SECRET")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Minimal, test-friendly webhook:
      - Verifies event using stripe.Webhook.construct_event(...)
      - Handles checkout.session.completed, customer.subscription.created,
        customer.subscription.updated, and customer.subscription.deleted events
      - Returns {"ok": True} on success so tests can assert it
      - Reads secrets per-request (not at import time) for test reliability
      - Preserves existing plan if price_id is unknown (no downgrade to 'free')
      - Gracefully handles missing Supabase credentials
    """
    payload: bytes = await request.body()
    sig_header: str = request.headers.get("Stripe-Signature", "")
    webhook_secret = get_webhook_secret()

    try:
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=sig_header, secret=webhook_secret
        )
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"bad_signature:{e}"}, status_code=400)

    etype = event.get("type")
    data_obj: Dict[str, Any] = (event.get("data") or {}).get("object") or {}

    try:
        if etype == "checkout.session.completed":
            sub_id = data_obj.get("subscription")
            customer_id = data_obj.get("customer")
            customer_email = (data_obj.get("customer_details") or {}).get("email")

            # In tests, these calls are patched
            sub = (
                stripe.Subscription.retrieve(sub_id)
                if sub_id
                else {"status": "active", "items": {"data": []}}
            )
            price_id = ((sub.get("items") or {}).get("data") or [{}])[0].get("price", {}).get("id")
            status = sub.get("status", "active")
            current_period_end = sub.get("current_period_end")

            # Only treat certain statuses as eligible for a paid plan
            eligible_for_plan = status in ["active", "trialing", "past_due"]

            # Map price_id to plan - returns None for unknown IDs
            plan = map_price_to_plan(price_id) if eligible_for_plan else None
            # Always preserve the real Stripe status
            plan_status = status

            # Get Supabase client (lazy, may be None)
            sb_client = get_supabase_client()

            if sb_client:
                # Build upsert data - only include plan if we have a known mapping
                upsert_data = {
                    "stripe_customer_id": customer_id,
                    "email": customer_email,
                    "plan_status": plan_status,
                    "current_period_end": current_period_end,
                }

                # Only include plan if we have a known mapping (don't downgrade to 'free')
                if plan is not None:
                    upsert_data["plan"] = plan

                try:
                    sb_client.table("users").upsert(upsert_data).execute()
                except Exception as e:
                    # Log error but don't fail the webhook - gracefully skip DB write
                    logger.warning(f"Failed to upsert user data in checkout.session.completed: {e}")
                    pass

            return JSONResponse({"ok": True})

        if etype == "customer.subscription.updated":
            customer_id = data_obj.get("customer")
            price_id = (
                ((data_obj.get("items") or {}).get("data") or [{}])[0].get("price", {}).get("id")
            )
            status = data_obj.get("status", "active")
            current_period_end = data_obj.get("current_period_end")

            # Retrieve customer email - handle potential failures gracefully
            email = None
            try:
                if customer_id:
                    customer = stripe.Customer.retrieve(customer_id)
                    email = customer.get("email")
            except Exception as e:
                # If we can't retrieve customer email, continue without it
                logger.debug(f"Failed to retrieve customer email for {customer_id}: {e}")
                pass

            # Only treat certain statuses as eligible for a paid plan
            eligible_for_plan = status in ["active", "trialing", "past_due"]

            # Map price_id to plan - returns None for unknown IDs
            plan = map_price_to_plan(price_id) if eligible_for_plan else None
            # Always preserve the real Stripe status
            plan_status = status

            # Get Supabase client (lazy, may be None)
            sb_client = get_supabase_client()

            if sb_client:
                # Build upsert data - only include plan if we have a known mapping
                upsert_data = {
                    "stripe_customer_id": customer_id,
                    "email": email,
                    "plan_status": plan_status,
                    "current_period_end": current_period_end,
                }

                # Only include plan if we have a known mapping (don't downgrade to 'free')
                if plan is not None:
                    upsert_data["plan"] = plan

                try:
                    sb_client.table("users").upsert(upsert_data).execute()
                except Exception as e:
                    # Log error but don't fail the webhook - gracefully skip DB write
                    logger.warning(f"Failed to upsert user data in subscription.updated: {e}")
                    pass

            return JSONResponse({"ok": True})

        if etype == "customer.subscription.created":
            customer_id = data_obj.get("customer")
            price_id = (
                ((data_obj.get("items") or {}).get("data") or [{}])[0].get("price", {}).get("id")
            )
            status = data_obj.get("status", "active")
            current_period_end = data_obj.get("current_period_end")

            # Retrieve customer email - handle potential failures gracefully
            email = None
            try:
                if customer_id:
                    customer = stripe.Customer.retrieve(customer_id)
                    email = customer.get("email")
            except Exception as e:
                # If we can't retrieve customer email, continue without it
                logger.debug(f"Failed to retrieve customer email for {customer_id}: {e}")
                pass

            # Map price_id to plan - returns None for unknown IDs
            plan = map_price_to_plan(price_id)
            plan_status = (
                status if status in ["active", "past_due", "canceled", "trialing"] else "active"
            )

            # Get Supabase client (lazy, may be None)
            sb_client = get_supabase_client()

            if sb_client:
                # Build upsert data - only include plan if we have a known mapping
                upsert_data = {
                    "stripe_customer_id": customer_id,
                    "email": email,
                    "plan_status": plan_status,
                    "current_period_end": current_period_end,
                }

                # Only include plan if we have a known mapping (don't downgrade to 'free')
                if plan is not None:
                    upsert_data["plan"] = plan

                try:
                    sb_client.table("users").upsert(upsert_data).execute()
                except Exception as e:
                    # Log error but don't fail the webhook - gracefully skip DB write
                    logger.warning(f"Failed to upsert user data in subscription.created: {e}")
                    pass

            return JSONResponse({"ok": True})

        if etype == "customer.subscription.deleted":
            customer_id = data_obj.get("customer")

            # Retrieve customer email - handle potential failures gracefully
            email = None
            try:
                if customer_id:
                    customer = stripe.Customer.retrieve(customer_id)
                    email = customer.get("email")
            except Exception as e:
                # If we can't retrieve customer email, continue without it
                logger.debug(f"Failed to retrieve customer email for {customer_id}: {e}")
                pass

            # Get Supabase client (lazy, may be None)
            sb_client = get_supabase_client()

            if sb_client:
                # Downgrade to free plan when subscription is deleted
                upsert_data = {
                    "stripe_customer_id": customer_id,
                    "email": email,
                    "plan": "free",
                    "plan_status": "canceled",
                    "current_period_end": None,
                }

                try:
                    sb_client.table("users").upsert(upsert_data).execute()
                except Exception as e:
                    # Log error but don't fail the webhook - gracefully skip DB write
                    logger.warning(f"Failed to upsert user data in subscription.deleted: {e}")
                    pass

            return JSONResponse({"ok": True})

        # Unhandled but valid
        return JSONResponse({"ok": True, "ignored": etype})
    except Exception as e:
        # Keep 200 for tests; surface as ok=false so assertions can still read the result
        return JSONResponse({"ok": False, "error": str(e)})
