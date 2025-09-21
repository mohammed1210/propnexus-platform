import os
from datetime import datetime, timezone

from supabase import Client, create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def _dt_from_ts(ts: int | None):
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def get_or_create_customer(email: str, stripe_customer_id: str | None):
    if supabase is None:
        return None

    # Upsert customer by email
    data = {"email": email}
    if stripe_customer_id:
        data["stripe_customer_id"] = stripe_customer_id

    resp = (
        supabase.table("customers")
        .upsert(data, on_conflict="email")
        .select("*")
        .execute()
    )
    return resp.data[0] if resp.data else None


def upsert_subscription(email: str, stripe_customer_id: str, subscription):
    """
    `subscription` is the Stripe subscription object or a dict with:
      - id
      - status
      - current_period_end (unix)
    """
    if supabase is None:
        return None

    # ensure customer exists
    customer = get_or_create_customer(
        email=email, stripe_customer_id=stripe_customer_id
    )
    if not customer:
        return None

    sub_data = {
        "customer_id": customer["id"],
        "stripe_subscription_id": subscription["id"],
        "status": subscription["status"],
        "current_period_end": _dt_from_ts(subscription.get("current_period_end")),
        "raw": subscription,  # store full for debugging
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

    # active if any sub status is 'active' or 'trialing'
    subs = (
        supabase.table("subscriptions")
        .select("status, current_period_end, customers!inner(email)")
        .eq("customers.email", email)
        .execute()
    ).data

    active = any(s["status"] in ("active", "trialing") for s in subs or [])
    return {"active": active, "subscriptions": subs or []}
