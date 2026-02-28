"""
LEGACY CODE - NOT CURRENTLY USED

This module contains legacy billing code that expects a different database schema
with separate 'customers' and 'subscriptions' tables. The current active billing
implementation uses the 'users' table directly (see stripe_webhook.py, stripe_routes.py,
and users_routes.py).

Keeping this file for reference in case the schema needs to be migrated to this pattern
in the future, but it is NOT imported or used by the current application.
"""

from datetime import datetime, timezone

from backend.utils.supabase_client import get_supabase
from supabase import Client

supabase: Client | None = get_supabase(required=False)


def _dt_from_ts(ts: int | None):
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def get_or_create_customer(email: str, stripe_customer_id: str | None):
    if supabase is None:
        return None
    data = {"email": email}
    if stripe_customer_id:
        data["stripe_customer_id"] = stripe_customer_id
    resp = supabase.table("customers").upsert(data, on_conflict="email").select("*").execute()
    return resp.data[0] if resp.data else None


def upsert_subscription(email: str, stripe_customer_id: str, subscription):
    if supabase is None:
        return None
    customer = get_or_create_customer(email=email, stripe_customer_id=stripe_customer_id)
    if not customer:
        return None

    # ✅ ensure serialisable
    try:
        raw_dict = subscription.to_dict()  # StripeObject usually supports this
    except Exception:
        raw_dict = subscription if isinstance(subscription, dict) else {}

    sub_data = {
        "customer_id": customer["id"],
        "stripe_subscription_id": subscription["id"],
        "status": subscription["status"],
        "current_period_end": _dt_from_ts(subscription.get("current_period_end")),
        "raw": raw_dict,
    }

    resp = (
        supabase.table("subscriptions")
        .upsert(sub_data, on_conflict="stripe_subscription_id")
        .select("*")
        .execute()
    )
    return resp.data[0] if resp.data else None


def get_entitlement_by_email(email: str) -> dict:
    if supabase is None:
        return {"active": False}
    subs = (
        supabase.table("subscriptions")
        .select("status, current_period_end, customers!inner(email)")
        .eq("customers.email", email)
        .execute()
    ).data
    active = any(s["status"] in ("active", "trialing") for s in subs or [])
    return {"active": active, "subscriptions": subs or []}
