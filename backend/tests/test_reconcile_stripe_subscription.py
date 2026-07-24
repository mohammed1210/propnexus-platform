from __future__ import annotations

import argparse

from backend.scripts import reconcile_stripe_subscription as reconcile


class AttrOnlyObject:
    def __init__(self, **values):
        for key, value in values.items():
            setattr(self, key, value)


def test_reconcile_canceled_subscription_writes_free(monkeypatch):
    writes: list[dict[str, object]] = []

    subscription = AttrOnlyObject(
        id="sub_canceled",
        customer="cus_canceled",
        status="canceled",
        current_period_end=1234567890,
        items=AttrOnlyObject(data=[AttrOnlyObject(price=AttrOnlyObject(id="price_pro"))]),
    )

    monkeypatch.setenv("STRIPE_SECRET_KEY", "test-secret-key")
    monkeypatch.setattr(
        reconcile,
        "_resolve",
        lambda args: (None, subscription, "cus_canceled", "Canceled@Example.COM"),
    )
    monkeypatch.setattr(reconcile, "get_supabase", lambda required=True: object())
    monkeypatch.setattr(reconcile, "_upsert_price_metadata", lambda *args, **kwargs: True)
    monkeypatch.setattr(reconcile, "_upsert_subscription_record", lambda *args, **kwargs: True)

    def _write_user_plan(*args, **kwargs):
        writes.append(kwargs)
        return True

    monkeypatch.setattr(reconcile, "_write_user_plan", _write_user_plan)
    monkeypatch.setattr(
        reconcile,
        "argparse",
        argparse,
    )
    monkeypatch.setattr(
        "sys.argv",
        ["reconcile_stripe_subscription.py", "--customer-id", "cus_canceled"],
    )

    assert reconcile.main() == 0
    assert writes == [
        {
            "customer_id": "cus_canceled",
            "email": "Canceled@Example.COM",
            "plan_status": "canceled",
            "current_period_end": 1234567890,
            "plan": "free",
        }
    ]
