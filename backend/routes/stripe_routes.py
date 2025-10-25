from __future__ import annotations

import datetime as dt
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..db import sb  # shared Supabase client (may be None if not configured)
from ..utils.stripe_utils import (
    construct_event_from_request,
    create_checkout_session,
    retrieve_customer_email,
)

router = APIRouter(prefix="/stripe", tags=["stripe"])

# --- ENV (backend) ---
PRICE_ID_DEFAULT = os.getenv("STRIPE_PRICE_ID", "").strip()
SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "https://propnexus-platform.vercel.app/success")
CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "https://propnexus-platform.vercel.app/billing/cancel")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

# Supabase mapping (customize with envs to match your schema)
SUB_TABLE = os.getenv("SUBSCRIPTION_TABLE", "profiles")
SUB_EMAIL_COL = os.getenv("SUBSCRIPTION_EMAIL_COL", "email")
SUB_TIER_COL = os.getenv("SUBSCRIPTION_TIER_COL", "subscription_tier")
SUB_STATUS_COL = os.getenv("SUBSCRIPTION_STATUS_COL", "subscription_status")
SUB_CUST_COL = os.getenv("SUBSCRIPTION_CUSTOMER_COL", "stripe_customer_id")
SUB_PERIOD_END_COL = os.getenv("SUBSCRIPTION_CURRENT_PERIOD_END_COL", "current_period_end")

# Basic tier mapping: default price → tier (override per-price with env)
# e.g. export TIER_FOR_price_123="pro"
DEFAULT_TIER = os.getenv("STRIPE_DEFAULT_TIER", "pro")


def price_to_tier(price_id: Optional[str]) -> str:
    if not price_id:
        return DEFAULT_TIER
    env_key = f"TIER_FOR_{price_id}".upper()
    return os.getenv(env_key, DEFAULT_TIER)

    Requires:
      - STRIPE_SECRET_KEY
      - STRIPE_PRICE_ID  (Price in test mode)
    """
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(
            status_code=400,
            detail="Stripe not configured (missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID)",
        )

def iso8601_from_unix(ts: Optional[int]) -> Optional[str]:
    if not ts:
        return None
    try:
        return dt.datetime.utcfromtimestamp(int(ts)).replace(tzinfo=dt.timezone.utc).isoformat()
    except Exception:
        return None


def upsert_subscription(
    *,
    email: str,
    customer_id: Optional[str],
    status: str,
    price_id: Optional[str],
    period_end_unix: Optional[int],
) -> None:
    """
    Upsert a user's subscription info into Supabase.
    Defaults assume a 'profiles' table keyed by email. Adjust envs to match your DB.
    """
    if not sb:
        # Supabase not configured; just no-op
        return

    payload: Dict[str, Any] = {
        SUB_EMAIL_COL: email,
        SUB_STATUS_COL: status,
        SUB_TIER_COL: price_to_tier(price_id),
    }
    if customer_id:
        payload[SUB_CUST_COL] = customer_id
    iso = iso8601_from_unix(period_end_unix)
    if iso:
        payload[SUB_PERIOD_END_COL] = iso

    # Upsert on email (change ON CONFLICT key by using envs if needed)
    sb.table(SUB_TABLE).upsert(payload, on_conflict=SUB_EMAIL_COL).execute()


@router.post("/checkout")
async def stripe_checkout(req: Request):
    data = await req.json()
    price_id = (data.get("priceId") or PRICE_ID_DEFAULT or "").strip()
    if not price_id:
        raise HTTPException(status_code=400, detail="Missing priceId")
    email = (data.get("email") or "").strip() or None
    session = create_checkout_session(price_id, SUCCESS_URL, CANCEL_URL, email)
    return JSONResponse(session)


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    event = None
    try:
        event = construct_event_from_request(payload, sig_header, WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    etype: str = event.get("type", "")
    data_obj: Dict[str, Any] = (event.get("data", {}) or {}).get("object", {}) or {}

    # --- Handle key events to keep Supabase in sync ---

    if etype == "checkout.session.completed":
        # Prefer customer_email from session; otherwise look up by customer id.
        email = (
            (data_obj.get("customer_details") or {}).get("email")
            or data_obj.get("customer_email")
            or retrieve_customer_email(data_obj.get("customer"))
        )
        if email:
            # Period end is not guaranteed here; rely on invoice event, but set active now.
            upsert_subscription(
                email=email,
                customer_id=data_obj.get("customer"),
                status="active",
                price_id=os.getenv("STRIPE_PRICE_ID") or None,
                period_end_unix=None,
            )

    elif etype == "invoice.payment_succeeded":
        # This contains definitive line/price + current_period_end.
        email = data_obj.get("customer_email") or retrieve_customer_email(data_obj.get("customer"))
        # best-effort to pull price_id and period end from first line
        line = ((data_obj.get("lines") or {}).get("data") or [{}])[0]
        price_id = ((line or {}).get("price") or {}).get("id")
        period_end = ((line or {}).get("period") or {}).get("end")
        if email:
            upsert_subscription(
                email=email,
                customer_id=data_obj.get("customer"),
                status="active",
                price_id=price_id,
                period_end_unix=period_end,
            )

    elif etype in {"customer.subscription.updated", "customer.subscription.deleted"}:
        # Reflect cancellation / status changes
        sub = data_obj
        status = sub.get("status") or ("canceled" if etype.endswith(".deleted") else "active")
        customer_id = sub.get("customer")
        price_id = None
        items = (sub.get("items") or {}).get("data") or []
        if items:
            price_id = ((items[0] or {}).get("price") or {}).get("id")
        period_end = sub.get("current_period_end") or None

        email = retrieve_customer_email(customer_id)
        if email:
            upsert_subscription(
                email=email,
                customer_id=customer_id,
                status=status,
                price_id=price_id,
                period_end_unix=period_end,
            )

    # Always acknowledge to Stripe
    return JSONResponse({"ok": True, "type": etype})
