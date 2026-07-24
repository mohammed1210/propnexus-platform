from __future__ import annotations

import hashlib
import logging
import os
from collections.abc import Mapping, Sequence
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.middleware.rate_limit import WEBHOOK_RATE_LIMIT, is_test_or_ci, limiter
from backend.utils.sentry_init import capture_exception, capture_message
from backend.utils.supabase_client import get_supabase

# Set up logger
logger = logging.getLogger(__name__)

# The tests patch both `stripe` and this module-level `supabase` symbol.
# Provide a placeholder here to make patching possible without import-time failures.
supabase = None  # will be monkeypatched by tests

router = APIRouter(prefix="/stripe", tags=["stripe"])

ELIGIBLE_STATUSES = {"active", "trialing", "past_due"}
TERMINAL_STATUSES = {"canceled", "incomplete_expired", "unpaid"}


def _monitor_webhook(
    message: str,
    *,
    event_id: Optional[str] = None,
    level: str = "info",
    event_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    object_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    subscription_status: Optional[str] = None,
    price_id: Optional[str] = None,
    mapped_plan: Optional[str] = None,
    email_hash: Optional[str] = None,
    db_write_succeeded: Optional[bool] = None,
    failure_kind: Optional[str] = None,
    exception_type: Optional[str] = None,
    result: Optional[str] = None,
) -> None:
    capture_message(
        message,
        level=level,
        stripe_webhook={
            "event_id": event_id,
            "event_type": event_type,
            "customer_id": customer_id,
            "object_id": object_id,
            "subscription_id": subscription_id,
            "subscription_status": subscription_status,
            "price_id": price_id,
            "mapped_plan": mapped_plan,
            "email_hash": email_hash,
            "db_write_succeeded": db_write_succeeded,
            "failure_kind": failure_kind,
            "exception_type": exception_type,
            "result": result,
        },
    )


def _stripe_webhook_rate_limit() -> str:
    """Allow a dedicated limit for Stripe webhooks to avoid accidental 429s."""
    return os.getenv("RATE_LIMIT_STRIPE_WEBHOOK", WEBHOOK_RATE_LIMIT)


def _stripe_secret_key() -> Optional[str]:
    return os.getenv("STRIPE_SECRET_KEY")


def _ensure_stripe_api_key() -> None:
    secret = _stripe_secret_key()
    if secret:
        stripe.api_key = secret


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
    # Prefer backend-only env vars, but accept NEXT_PUBLIC_* as a fallback
    # to reduce config drift between frontend and backend.
    price_to_plan = {
        (os.getenv("STRIPE_PRICE_PRO") or os.getenv("NEXT_PUBLIC_STRIPE_PRICE_PRO") or ""): "pro",
        (
            os.getenv("STRIPE_PRICE_INVESTOR")
            or os.getenv("NEXT_PUBLIC_STRIPE_PRICE_INVESTOR")
            or ""
        ): "investor",
    }

    # Remove empty keys from mapping
    price_to_plan = {k: v for k, v in price_to_plan.items() if k}
    direct_plan = price_to_plan.get(price_id)
    if direct_plan:
        return direct_plan

    product_to_plan = {
        (
            os.getenv("STRIPE_PRODUCT_PRO") or os.getenv("NEXT_PUBLIC_STRIPE_PRODUCT_PRO") or ""
        ): "pro",
        (
            os.getenv("STRIPE_PRODUCT_INVESTOR")
            or os.getenv("NEXT_PUBLIC_STRIPE_PRODUCT_INVESTOR")
            or "prod_TGprLukyGJfRBH"
        ): "investor",
    }
    product_to_plan = {k: v for k, v in product_to_plan.items() if k}

    if not product_to_plan:
        return None

    try:
        _ensure_stripe_api_key()
        price = stripe.Price.retrieve(price_id)
        product_id = _stripe_value(price, "product")
        return product_to_plan.get(product_id)
    except Exception as exc:
        logger.warning(
            "Could not map Stripe price to plan by product",
            extra={"price_id": price_id, "error": str(exc)},
        )
        return None


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

    try:
        return get_supabase(required=False)
    except Exception as e:
        # Keep webhook resilient: never hard-fail on Supabase init.
        logger.debug(f"Failed to create Supabase client: {e}")
        return None


def get_webhook_secret() -> Optional[str]:
    """Get Stripe webhook secret from environment on each request."""
    return os.getenv("STRIPE_WEBHOOK_SECRET")


def _as_dict(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    try:
        return obj.to_dict()  # StripeObject commonly supports this
    except Exception:
        return {}


def _stripe_value(value: Any, key: str, default: Any = None) -> Any:
    """Read a Stripe field from mappings or StripeObject-style attributes."""
    if value is None:
        return default

    if isinstance(value, Mapping):
        return value.get(key, default)

    try:
        return getattr(value, key)
    except (AttributeError, TypeError):
        pass

    try:
        return value[key]
    except (KeyError, IndexError, TypeError, AttributeError):
        return default


def _stripe_object_id(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    object_id = _stripe_value(value, "id")
    return str(object_id) if object_id else None


def _stripe_list_data(value: Any) -> list[Any]:
    data = _stripe_value(value, "data", [])
    if isinstance(data, Sequence) and not isinstance(data, (str, bytes, bytearray)):
        return list(data)
    return []


def _subscription_price_id(subscription: Any) -> Optional[str]:
    items = _stripe_value(subscription, "items", {})
    first_item = (_stripe_list_data(items) or [{}])[0]
    price = _stripe_value(first_item, "price", {})
    return _stripe_object_id(price)


def _subscription_metadata_email(subscription: Any) -> Optional[str]:
    metadata = _stripe_value(subscription, "metadata", {})
    return _normalize_email(_stripe_value(metadata, "email"))


def _event_data_object(event: Any) -> Any:
    return _stripe_value(_stripe_value(event, "data", {}), "object", {}) or {}


def _normalize_email(email: Optional[str]) -> Optional[str]:
    value = str(email or "").strip().lower()
    if not value or "@" not in value:
        return None
    return value


def _email_hash(email: Optional[str]) -> Optional[str]:
    normalized = _normalize_email(email)
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _response_has_rows(response: Any) -> bool:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return len(data) > 0
    if isinstance(data, dict):
        return bool(data)
    return False


def _customer_email(customer_value: Any) -> Optional[str]:
    expanded_email = _normalize_email(_stripe_value(customer_value, "email"))
    if expanded_email:
        return expanded_email

    customer_id = _stripe_object_id(customer_value)
    if not customer_id:
        return None

    try:
        customer = stripe.Customer.retrieve(customer_id)
        return _normalize_email(_stripe_value(customer, "email"))
    except Exception as e:
        logger.debug(f"Failed to retrieve customer email for {customer_id}: {e}")
        return None


def _resolve_checkout_email(data_obj: Any) -> Optional[str]:
    customer_details = _stripe_value(data_obj, "customer_details", {}) or {}
    metadata = _stripe_value(data_obj, "metadata", {}) or {}

    return (
        _normalize_email(_stripe_value(metadata, "email"))
        or _normalize_email(_stripe_value(customer_details, "email"))
        or _normalize_email(_stripe_value(data_obj, "customer_email"))
        or _customer_email(_stripe_value(data_obj, "customer"))
    )


def _entitled_plan_for_status(status: Optional[str], price_id: Optional[str]) -> Optional[str]:
    if status in ELIGIBLE_STATUSES:
        return map_price_to_plan(price_id) if price_id else None
    return "free"


def _process_subscription_entitlement(
    *,
    event_id: Optional[str],
    event_type: str,
    subscription: Any,
    email_hint: Optional[str] = None,
    customer_id_hint: Optional[str] = None,
    subscription_id_hint: Optional[str] = None,
    deleted: bool = False,
) -> JSONResponse:
    subscription_id = _stripe_object_id(subscription) or subscription_id_hint
    customer_value = _stripe_value(subscription, "customer")
    customer_id = _stripe_object_id(customer_value) or customer_id_hint
    status = "canceled" if deleted else str(_stripe_value(subscription, "status", "active"))
    current_period_end = None if deleted else _stripe_value(subscription, "current_period_end")
    price_id = None if deleted else _subscription_price_id(subscription)
    email = (
        email_hint or _subscription_metadata_email(subscription) or _customer_email(customer_value)
    )
    plan = (
        "free"
        if deleted or status in TERMINAL_STATUSES
        else _entitled_plan_for_status(status, price_id)
    )

    if status in ELIGIBLE_STATUSES and not plan:
        _monitor_webhook(
            "stripe_webhook_entitlement_write_failed",
            level="error",
            event_id=event_id,
            event_type=event_type,
            object_id=subscription_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            subscription_status=status,
            price_id=price_id,
            mapped_plan=plan,
            email_hash=_email_hash(email),
            db_write_succeeded=False,
            failure_kind="unknown_price_id",
            result="retryable_failure",
        )
        return _entitlement_failure_response("unknown_price_id")

    sb_client = get_supabase_client()
    if not sb_client:
        _monitor_webhook(
            "stripe_webhook_entitlement_write_failed",
            level="error",
            event_id=event_id,
            event_type=event_type,
            object_id=subscription_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            subscription_status=status,
            price_id=price_id,
            mapped_plan=plan,
            email_hash=_email_hash(email),
            db_write_succeeded=False,
            failure_kind="missing_supabase_client",
            result="retryable_failure",
        )
        return _entitlement_failure_response()

    try:
        price_ok = True if deleted else _upsert_price_metadata(sb_client, price_id)
        sub_ok = _upsert_subscription_record(
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
    except Exception as e:
        logger.warning(
            "Failed to write Stripe subscription entitlement data",
            extra={
                "event_id": event_id,
                "event_type": event_type,
                "customer_id": customer_id,
                "subscription_id": subscription_id,
                "subscription_status": status,
                "price_id": price_id,
                "mapped_plan": plan,
                "email_hash": _email_hash(email),
                "exception_type": type(e).__name__,
                "error": str(e),
            },
        )
        _monitor_webhook(
            "stripe_webhook_entitlement_write_failed",
            level="error",
            event_id=event_id,
            event_type=event_type,
            object_id=subscription_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            subscription_status=status,
            price_id=price_id,
            mapped_plan=plan,
            email_hash=_email_hash(email),
            db_write_succeeded=False,
            failure_kind="db_write_exception",
            exception_type=type(e).__name__,
            result="retryable_failure",
        )
        return _entitlement_failure_response()

    if not all([price_ok, sub_ok]):
        _monitor_webhook(
            "stripe_webhook_partial_db_write",
            level="warning",
            event_id=event_id,
            event_type=event_type,
            object_id=subscription_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            subscription_status=status,
            price_id=price_id,
            mapped_plan=plan,
            email_hash=_email_hash(email),
            db_write_succeeded=False,
            failure_kind="db_write_soft_failure",
            result="processed_with_warnings",
        )

    if not user_ok:
        _monitor_webhook(
            "stripe_webhook_entitlement_write_failed",
            level="error",
            event_id=event_id,
            event_type=event_type,
            object_id=subscription_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            subscription_status=status,
            price_id=price_id,
            mapped_plan=plan,
            email_hash=_email_hash(email),
            db_write_succeeded=False,
            failure_kind="entitlement_write_failed",
            result="retryable_failure",
        )
        return _entitlement_failure_response()

    _monitor_webhook(
        "stripe_webhook_processed",
        level="info",
        event_id=event_id,
        event_type=event_type,
        object_id=subscription_id,
        customer_id=customer_id,
        subscription_id=subscription_id,
        subscription_status=status,
        price_id=price_id,
        mapped_plan=plan,
        email_hash=_email_hash(email),
        db_write_succeeded=True,
        result="processed",
    )
    return JSONResponse({"ok": True})


def _entitlement_failure_response(failure_kind: str = "entitlement_write_failed") -> JSONResponse:
    return JSONResponse({"ok": False, "error": failure_kind}, status_code=500)


def _upsert_price_metadata(sb_client: Any, price_id: Optional[str]) -> bool:
    if not sb_client or not price_id:
        return True

    try:
        # Stripe API key is required for this call in production.
        price_obj = stripe.Price.retrieve(price_id)
        price = _as_dict(price_obj)
    except Exception as e:
        logger.debug(f"Failed to retrieve Stripe price {price_id}: {e}")
        return False

    data = {
        "stripe_price_id": price_id,
        "product_id": _stripe_value(price, "product"),
        "nickname": _stripe_value(price, "nickname"),
        "unit_amount": _stripe_value(price, "unit_amount"),
        "currency": _stripe_value(price, "currency"),
        "billing_interval": _stripe_value(_stripe_value(price, "recurring", {}), "interval"),
    }

    try:
        sb_client.table("prices").upsert(data, on_conflict="stripe_price_id").execute()
        return True
    except Exception as e:
        logger.warning(f"Failed to upsert price metadata for {price_id}: {e}")
        return False


def _upsert_subscription_record(
    sb_client: Any,
    *,
    email: Optional[str],
    customer_id: Optional[str],
    subscription_id: Optional[str],
    status: Optional[str],
    price_id: Optional[str],
) -> bool:
    email = _normalize_email(email)
    if not sb_client or not email:
        return True

    data = {
        "email": email,
        "stripe_customer_id": customer_id,
        "subscription_id": subscription_id,
        "status": status or "inactive",
        "price_id": price_id,
    }

    try:
        # Schema uses a single row per email (email UNIQUE).
        sb_client.table("subscriptions").upsert(data, on_conflict="email").execute()
        return True
    except Exception as e:
        logger.warning(
            "Failed to upsert subscription record",
            extra={"email_hash": _email_hash(email), "error": str(e)},
        )
        return False


def _write_user_plan(
    sb_client: Any,
    *,
    customer_id: Optional[str],
    email: Optional[str],
    plan_status: Optional[str],
    current_period_end: Optional[int],
    plan: Optional[str],
) -> bool:
    if not sb_client:
        return False

    email = _normalize_email(email)

    base = {
        "stripe_customer_id": customer_id,
        "plan_status": plan_status,
        "current_period_end": current_period_end,
    }
    if plan is not None:
        base["plan"] = plan

    try:
        if email:
            update_res = sb_client.table("users").update(base).eq("email", email).execute()
            if _response_has_rows(update_res):
                return True

            upsert_data = {**base, "email": email}
            sb_client.table("users").upsert(upsert_data, on_conflict="email").execute()
        elif customer_id:
            sb_client.table("users").update(base).eq("stripe_customer_id", customer_id).execute()
        else:
            return False
        return True
    except Exception as e:
        logger.warning(
            "Failed to write user plan data",
            extra={
                "customer_id": customer_id,
                "email_hash": _email_hash(email),
                "mapped_plan": plan,
                "error": str(e),
            },
        )
        return False


@router.post("/webhook")
@limiter.limit(_stripe_webhook_rate_limit(), exempt_when=is_test_or_ci)
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

    _monitor_webhook(
        "stripe_webhook_received",
        level="info",
        db_write_succeeded=None,
    )

    if not payload:
        _monitor_webhook(
            "stripe_webhook_invalid_payload",
            level="warning",
            failure_kind="missing_payload",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": "missing_payload"}, status_code=400)

    # Missing signature header is always a bad request from Stripe's perspective.
    if not sig_header:
        _monitor_webhook(
            "stripe_webhook_signature_failure",
            level="warning",
            failure_kind="missing_stripe_signature",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": "missing_stripe_signature"}, status_code=400)

    # Missing secret is a server misconfiguration (should not be a 400).
    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not set")
        _monitor_webhook(
            "stripe_webhook_unexpected_exception",
            level="error",
            failure_kind="missing_webhook_secret",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": "missing_webhook_secret"}, status_code=500)

    # Ensure Stripe client is configured for any retrieve() calls below.
    _ensure_stripe_api_key()

    try:
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=sig_header, secret=webhook_secret
        )
    except stripe.error.SignatureVerificationError as e:
        _monitor_webhook(
            "stripe_webhook_signature_failure",
            level="warning",
            failure_kind="bad_signature",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": f"bad_signature:{e}"}, status_code=400)
    except ValueError as e:
        # Raised for invalid JSON / parsing problems.
        _monitor_webhook(
            "stripe_webhook_invalid_payload",
            level="warning",
            failure_kind="bad_payload",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": f"bad_payload:{e}"}, status_code=400)
    except Exception as e:
        # Unexpected failures here are usually configuration/library issues.
        logger.exception(f"Unexpected error constructing Stripe event: {e}")
        capture_exception(e, stripe_webhook={"failure_kind": "construct_event_exception"})
        _monitor_webhook(
            "stripe_webhook_unexpected_exception",
            level="error",
            failure_kind="construct_event_exception",
            db_write_succeeded=False,
        )
        return JSONResponse({"ok": False, "error": "webhook_internal_error"}, status_code=500)

    etype = _stripe_value(event, "type")
    event_id = _stripe_value(event, "id")
    data_obj: Any = _event_data_object(event)

    try:
        if etype == "checkout.session.completed":
            sub_value = _stripe_value(data_obj, "subscription")
            sub_id = _stripe_object_id(sub_value)
            customer_email = _resolve_checkout_email(data_obj)
            sub = stripe.Subscription.retrieve(sub_id) if sub_id else sub_value
            return _process_subscription_entitlement(
                event_id=event_id,
                event_type=etype,
                subscription=sub,
                email_hint=customer_email,
                customer_id_hint=_stripe_object_id(_stripe_value(data_obj, "customer")),
                subscription_id_hint=sub_id,
            )

        if etype in {"customer.subscription.created", "customer.subscription.updated"}:
            return _process_subscription_entitlement(
                event_id=event_id,
                event_type=etype,
                subscription=data_obj,
            )

        if etype == "customer.subscription.deleted":
            return _process_subscription_entitlement(
                event_id=event_id,
                event_type=etype,
                subscription=data_obj,
                deleted=True,
            )

        # Unhandled but valid
        _monitor_webhook(
            "stripe_webhook_processed",
            level="info",
            event_id=event_id,
            event_type=etype,
            object_id=_stripe_object_id(data_obj),
            customer_id=_stripe_object_id(_stripe_value(data_obj, "customer")),
            subscription_id=_stripe_object_id(data_obj),
            db_write_succeeded=None,
            result="ignored",
        )
        return JSONResponse({"ok": True, "ignored": etype})
    except Exception as e:
        capture_exception(
            e,
            stripe_webhook={
                "event_id": event_id,
                "event_type": etype,
                "object_id": _stripe_object_id(data_obj),
                "customer_id": _stripe_object_id(_stripe_value(data_obj, "customer")),
                "subscription_id": _stripe_object_id(data_obj),
                "failure_kind": "unexpected_processing_exception",
                "exception_type": type(e).__name__,
            },
        )
        _monitor_webhook(
            "stripe_webhook_unexpected_exception",
            level="error",
            event_id=event_id,
            event_type=etype,
            object_id=_stripe_object_id(data_obj),
            customer_id=_stripe_object_id(_stripe_value(data_obj, "customer")),
            subscription_id=_stripe_object_id(data_obj),
            db_write_succeeded=False,
            failure_kind="unexpected_processing_exception",
            exception_type=type(e).__name__,
            result="retryable_failure",
        )
        return JSONResponse({"ok": False, "error": "webhook_processing_failed"}, status_code=500)
