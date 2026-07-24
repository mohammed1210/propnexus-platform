from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import stripe

from backend.routes.stripe_webhook import (
    ELIGIBLE_STATUSES,
    TERMINAL_STATUSES,
    _normalize_email,
    _stripe_list_data,
    _stripe_object_id,
    _stripe_value,
    _upsert_price_metadata,
    _upsert_subscription_record,
    _write_user_plan,
    map_price_to_plan,
)
from backend.utils.supabase_client import get_supabase


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        return value.to_dict_recursive()
    except Exception:
        try:
            return value.to_dict()
        except Exception:
            return {}


def _customer_email(customer: Any) -> str | None:
    data = _as_dict(customer)
    return _normalize_email(_stripe_value(data, "email") or _stripe_value(customer, "email"))


def _subscription_price_id(subscription: Any) -> str | None:
    first_item = (_stripe_list_data(_stripe_value(subscription, "items", {})) or [{}])[0]
    return _stripe_object_id(_stripe_value(first_item, "price"))


def _retrieve_checkout_session(
    session_id: str,
) -> tuple[dict[str, Any], dict[str, Any], str | None]:
    session = _as_dict(
        stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription", "customer"],
        )
    )
    subscription_value = _stripe_value(session, "subscription")
    subscription = (
        subscription_value
        if isinstance(subscription_value, dict)
        else _as_dict(stripe.Subscription.retrieve(subscription_value))
    )
    customer = _stripe_value(session, "customer")
    email = _normalize_email(_stripe_value(_stripe_value(session, "metadata", {}), "email"))
    email = email or _normalize_email(
        _stripe_value(_stripe_value(session, "customer_details", {}), "email")
    )
    email = email or _normalize_email(_stripe_value(session, "customer_email"))
    email = email or _customer_email(customer)
    return session, subscription, email


def _find_customer_by_email(email: str) -> dict[str, Any]:
    results = stripe.Customer.search(query=f"email:'{email}'", limit=1)
    data = getattr(results, "data", None) or []
    if not data:
        raise RuntimeError("No Stripe customer found for email")
    return _as_dict(data[0])


def _find_subscription_for_customer(customer_id: str) -> dict[str, Any]:
    subscriptions = stripe.Subscription.list(customer=customer_id, status="all", limit=10)
    items = [_as_dict(item) for item in (getattr(subscriptions, "data", None) or [])]
    eligible = [item for item in items if _stripe_value(item, "status") in ELIGIBLE_STATUSES]
    if eligible:
        return eligible[0]
    if items:
        return items[0]
    raise RuntimeError("No Stripe subscription found for customer")


def _resolve(
    args: argparse.Namespace,
) -> tuple[dict[str, Any] | None, dict[str, Any], str | None, str | None]:
    if args.checkout_session_id:
        session, subscription, email = _retrieve_checkout_session(args.checkout_session_id)
        customer = _stripe_value(session, "customer")
        customer_id = _stripe_object_id(customer)
        return session, subscription, customer_id, email

    if args.customer_id:
        customer = _as_dict(stripe.Customer.retrieve(args.customer_id))
        subscription = _find_subscription_for_customer(args.customer_id)
        return None, subscription, args.customer_id, _customer_email(customer)

    if args.email:
        email = _normalize_email(args.email)
        if not email:
            raise RuntimeError("A valid email is required")
        customer = _find_customer_by_email(email)
        customer_id = _stripe_object_id(customer)
        subscription = _find_subscription_for_customer(customer_id)
        return None, subscription, customer_id, email

    raise RuntimeError("Provide --email, --customer-id, or --checkout-session-id")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reconcile a Stripe subscription into Supabase users/subscriptions."
    )
    parser.add_argument("--email", help="Customer email to reconcile")
    parser.add_argument("--customer-id", help="Stripe customer id to reconcile")
    parser.add_argument("--checkout-session-id", help="Stripe checkout session id to reconcile")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve and print the intended update without writing",
    )
    args = parser.parse_args()

    secret = os.getenv("STRIPE_SECRET_KEY")
    if not secret:
        raise RuntimeError("STRIPE_SECRET_KEY is required")
    stripe.api_key = secret

    _session, subscription, customer_id, email = _resolve(args)
    subscription_id = _stripe_object_id(subscription)
    status = _stripe_value(subscription, "status")
    current_period_end = _stripe_value(subscription, "current_period_end")
    price_id = _subscription_price_id(subscription)
    plan = map_price_to_plan(price_id) if status in ELIGIBLE_STATUSES else "free"
    if status in TERMINAL_STATUSES:
        plan = "free"

    result = {
        "dry_run": args.dry_run,
        "email": email,
        "stripe_customer_id": customer_id,
        "subscription_id": subscription_id,
        "status": status,
        "price_id": price_id,
        "mapped_plan": plan,
        "eligible_status": status in ELIGIBLE_STATUSES,
    }

    if status in ELIGIBLE_STATUSES and not plan:
        result["ok"] = False
        result["error"] = "unknown_price_id"
        print(json.dumps(result, indent=2, sort_keys=True))
        return 2

    if args.dry_run:
        result["ok"] = True
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0

    sb_client = get_supabase(required=True)
    _upsert_price_metadata(sb_client, price_id)
    _upsert_subscription_record(
        sb_client,
        email=email,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        price_id=price_id,
    )
    user_ok = _write_user_plan(
        sb_client,
        customer_id=customer_id,
        email=email,
        plan_status=status,
        current_period_end=current_period_end,
        plan=plan,
    )
    result["ok"] = user_ok
    if not user_ok:
        result["error"] = "entitlement_write_failed"
        print(json.dumps(result, indent=2, sort_keys=True))
        return 1

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            json.dumps({"ok": False, "error": str(exc)}, indent=2, sort_keys=True), file=sys.stderr
        )
        raise SystemExit(1)
