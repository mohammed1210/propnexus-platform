# backend/tests/test_schema_contracts_guardrail.py

"""
Schema guardrail tests for Supabase -> Backend -> Frontend contracts.

These tests:
- Ensure the `properties` table has all columns the backend/frontend expect.
- Ensure the `users` table has the Stripe + plan fields needed for billing.
"""

import os
import httpx
import pytest


SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def _assert_env():
    assert SUPABASE_URL, "SUPABASE_URL must be set for schema guardrail tests"
    assert (
        SUPABASE_SERVICE_ROLE_KEY
    ), "SUPABASE_SERVICE_ROLE_KEY must be set for schema guardrail tests"


def fetch_columns(table_name: str) -> set[str]:
    """
    Query information_schema.columns via Supabase REST to get the column names
    for a given table.
    """
    _assert_env()

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/information_schema.columns"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    params = {
        "table_name": f"eq.{table_name}",
        "select": "column_name",
    }

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    return {row["column_name"] for row in data}


@pytest.mark.skipif(
    not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY,
    reason="Supabase env vars not set",
)
def test_properties_table_has_required_columns():
    """
    Guardrail: if we ever drop/rename one of these columns in Supabase,
    this test fails in CI before breaking the app.
    """
    required_cols = {
        "id",
        "title",
        "description",
        "location",
        "price",
        "bedrooms",
        "bathrooms",
        "latitude",
        "longitude",
        "imageurl",
        "yield_percent",
        "roi_percent",
        "investment_type",
        "created_at",
        "source",
        "source_id",
        "property_type",
        "postcode",
        "url",
    }

    cols = fetch_columns("properties")

    missing = required_cols - cols
    assert not missing, f"Missing columns in properties table: {sorted(missing)}"


@pytest.mark.skipif(
    not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY,
    reason="Supabase env vars not set",
)
def test_users_table_has_billing_columns():
    """
    Guardrail: ensure the billing fields exist on public.users.

    NOTE: This targets your custom public.users table, not auth.users.
    """
    required_cols = {
        "id",
        "email",
        "plan",
        "role",
        "stripe_customer_id",
        "stripe_subscription_id",
        "stripe_subscription_status",
        "stripe_current_period_end",
        "created_at",
        "updated_at",
    }

    cols = fetch_columns("users")

    missing = required_cols - cols
    assert not missing, f"Missing columns in users table: {sorted(missing)}"
    