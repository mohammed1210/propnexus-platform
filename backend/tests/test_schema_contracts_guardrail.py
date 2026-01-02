import os
from typing import Set

import pytest
from supabase import Client, create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_sb_client() -> Client:
    """
    Construct a Supabase client using the service role key.
    Used by the schema guardrail tests.
    """
    assert SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, (
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for schema tests"
    )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_columns(table_name: str) -> Set[str]:
    """
    Infer column names for a given table by fetching a single row.

    If the table has no rows, we skip the test rather than failing – we can't
    reliably infer columns from an empty result set.
    """
    sb = get_sb_client()

    resp = sb.table(table_name).select("*").limit(1).execute()
    data = resp.data or []

    if not data:
        pytest.skip(f"No rows in table '{table_name}', cannot infer columns")
    sample = data[0]
    return set(sample.keys())


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
    assert not missing, f"Missing columns in properties: {sorted(missing)}"


@pytest.mark.skipif(
    not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY,
    reason="Supabase env vars not set",
)
def test_users_table_has_minimum_columns():
    """
    Softer guardrail for public.users.

    For now we just assert the core identity fields exist. The full billing
    metadata (Stripe IDs, plan, timestamps, etc.) can be added later.
    """
    minimum_cols = {
        "id",
        "email",
    }

    cols = fetch_columns("users")
    missing = minimum_cols - cols
    assert not missing, f"Missing required columns in users: {sorted(missing)}"
