from __future__ import annotations

import os
from typing import Any, Dict

import stripe

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY") or ""
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def get_stripe_client() -> stripe:
    if not STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY missing")
    return stripe


def create_checkout_session(
    price_id: str,
    success_url: str,
    cancel_url: str,
    customer_email: str | None = None,
) -> Dict[str, Any]:
    client = get_stripe_client()
    session = client.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=customer_email,
        allow_promotion_codes=True,
        automatic_tax={"enabled": True},
    )
    return {"id": session.id, "url": session.url}


def construct_event_from_request(payload: bytes, sig_header: str, webhook_secret: str):
    if not webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET missing")
    client = get_stripe_client()
    return client.Webhook.construct_event(
        payload=payload, sig_header=sig_header, secret=webhook_secret
    )
