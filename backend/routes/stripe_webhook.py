# backend/routes/stripe_webhook.py
from __future__ import annotations

import json
import os
from typing import Optional

import stripe
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from supabase import Client, create_client

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- Env (use SERVICE ROLE key for server writes!) ---
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Prefer service role if present, falls back to normal key
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

if not STRIPE_SECRET_KEY:
    # Don’t crash the app—just log. Webhook will 500 with a clear message.
    print("[stripe_webhook] STRIPE_SECRET_KEY missing")

stripe.api_key = STRIPE_SECRET_KEY

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    print("[stripe_webhook] Supabase not fully configured; writes will be skipped.")

# === Supabase helpers =========================================================
# Database schema configuration for Stripe webhook processing
# These constants define the expected table and column names in Supabase.
# Ensure your database schema matches these definitions:
#
# users table:
#   - email (text, UNIQUE): user email address
#   - stripe_customer_id (text): Stripe customer ID
#
# subscriptions table:
#   - email (text): user email address
#   - stripe_customer_id (text): Stripe customer ID
#   - status (text): subscription status
#   - price_id (text): Stripe price ID
#   - subscription_id (text): Stripe subscription ID

USERS_TABLE = "users"
USERS_EMAIL_COL = "email"
USERS_CUSTOMER_COL = "stripe_customer_id"

SUBS_TABLE = "subscriptions"
SUBS_EMAIL_COL = "email"
SUBS_CUSTOMER_COL = "stripe_customer_id"
SUBS_STATUS_COL = "status"
SUBS_PRICE_ID_COL = "price_id"
SUBS_SUB_ID_COL = "subscription_id"


def _safe_upsert(table: str, payload: dict, on_conflict: str):
    """Upsert with strong guards + logging; never throw to the webhook response."""
    if not supabase:
        print(f"[supabase] Skipping write, client not configured. ({table})")
        return
    if not payload or not isinstance(payload, dict):
        print(f"[supabase] Skipping write, payload is empty/invalid. ({table}) -> {payload}")
        return
    try:
        # NOTE: for on_conflict to work, the target column must have a UNIQUE index
        resp = supabase.table(table).upsert(payload, on_conflict=on_conflict).execute()
        # PostgREST returns 201 with an empty body by default. Don’t assume data is present.
        if getattr(resp, "data", None):
            print(f"[supabase] Upsert OK -> {table}: {resp.data}")
        else:
            print(f"[supabase] Upsert OK (no body) -> {table}")
    except Exception as e:
        print(f"[supabase] Upsert FAILED -> {table}: {e}")


def upsert_user_customer(email: str, customer_id: str):
    _safe_upsert(
        USERS_TABLE,
        {USERS_EMAIL_COL: email, USERS_CUSTOMER_COL: customer_id},
        on_conflict=USERS_EMAIL_COL,
    )


def upsert_subscription_record(
    email: str,
    customer_id: str,
    subscription_id: Optional[str],
    status: Optional[str],
    price_id: Optional[str],
):
    _safe_upsert(
        SUBS_TABLE,
        {
            SUBS_EMAIL_COL: email,
            SUBS_CUSTOMER_COL: customer_id,
            SUBS_SUB_ID_COL: subscription_id,
            SUBS_STATUS_COL: status,
            SUBS_PRICE_ID_COL: price_id,
        },
        on_conflict=SUBS_EMAIL_COL,  # keep one row per user; change if you want history
    )


# === Utilities ================================================================


def _extract_email_from_session(session_obj: dict) -> Optional[str]:
    # Stripe can put email in different places depending on how Checkout was created
    return (
        session_obj.get("customer_details", {}).get("email")
        or session_obj.get("customer_email")
        or None
    )


def _get_customer_email(customer_id: str) -> Optional[str]:
    try:
        cust = stripe.Customer.retrieve(customer_id)
        return cust.get("email")
    except Exception as e:
        print(f"[stripe] Could not retrieve customer {customer_id}: {e}")
        return None


# === Webhook =================================================================


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured on server")

    raw = await request.body()

    # Verify signature if configured (recommended in prod)
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload=raw, sig_header=stripe_signature, secret=STRIPE_WEBHOOK_SECRET
            )
        else:
            event = json.loads(raw.decode("utf-8"))
    except Exception as e:
        print(f"[webhook] Signature/parse error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {e}")

    etype = event.get("type")
    data = event.get("data", {}).get("object", {}) or {}

    print(f"[webhook] Received event: {etype}")

    # --- 1) Checkout completed: capture customer + email, upsert user and (optional) subscription ---
    if etype == "checkout.session.completed":
        customer_id = data.get("customer")  # cus_***
        email = _extract_email_from_session(data)
        if not email and customer_id:
            email = _get_customer_email(customer_id)

        if customer_id and email:
            upsert_user_customer(email=email, customer_id=customer_id)

        # If you’re using subscriptions through Checkout, you’ll get subscription id on the session
        subscription_id = data.get("subscription")
        price_id = None
        # price can be in display_items/line_items, but not present in test fixtures sometimes.
        # We keep this optional.
        if subscription_id and customer_id and email:
            try:
                sub = stripe.Subscription.retrieve(subscription_id)
                status = sub.get("status")
                # get price id from first item if available
                items = sub.get("items", {}).get("data", [])
                if items:
                    price_id = items[0].get("price", {}).get("id")
                upsert_subscription_record(
                    email=email,
                    customer_id=customer_id,
                    subscription_id=subscription_id,
                    status=status,
                    price_id=price_id,
                )
            except Exception as e:
                print(f"[stripe] Could not retrieve subscription {subscription_id}: {e}")

    # --- 2) Subscription lifecycle (optional bookkeeping) ---------------------
    elif etype in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        sub = data
        customer_id = sub.get("customer")
        status = sub.get("status")
        subscription_id = sub.get("id")
        price_id = None
        items = sub.get("items", {}).get("data", [])
        if items:
            price_id = items[0].get("price", {}).get("id")

        email = None
        if customer_id:
            email = _get_customer_email(customer_id)

        if email and customer_id:
            upsert_subscription_record(
                email=email,
                customer_id=customer_id,
                subscription_id=subscription_id,
                status=status,
                price_id=price_id,
            )

    # Always 200 so Stripe stops retrying
    return JSONResponse(status_code=200, content={"ok": True})
