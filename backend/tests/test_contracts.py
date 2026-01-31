import os
from typing import List

import httpx
import pytest
from dotenv import load_dotenv

from supabase import Client, create_client

load_dotenv()


# --- Supabase helper ---------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# The columns we expect to exist in the properties table / API
REQUIRED_PROPERTIES_COLS: List[str] = [
    "id",
    "title",
    "location",
    "price",
    "bedrooms",
    "bathrooms",
    "created_at",
]


def get_sb_client() -> Client:
    """
    Construct a Supabase client using the service role key.
    Used by the schema contract tests.
    """
    # Instead of asserting (hard fail), skip when not configured
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        pytest.skip(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; skipping Supabase schema contract test."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _get_backend_url() -> str | None:
    """
    Integration tests that require a running backend.
    We ONLY run them when BACKEND_URL is explicitly set.
    (Avoids failing locally/CI when no server is running.)
    """
    return os.environ.get("BACKEND_URL")


# --- TEST 1: PROPERTIES TABLE SCHEMA CONTRACT -------------------------------


@pytest.mark.asyncio
async def test_properties_table_schema_contract() -> None:
    """
    Verify that the 'properties' table in Supabase exposes the expected columns.
    This is a guardrail so backend/frontend don't silently drift from the DB.
    """
    sb = get_sb_client()
    res = sb.table("properties").select(",".join(REQUIRED_PROPERTIES_COLS)).limit(1).execute()

    # We only care that the query succeeds and the columns are present
    assert res.data is not None
    if res.data:
        sample = res.data[0]
        for col in REQUIRED_PROPERTIES_COLS:
            assert col in sample, f"Column '{col}' missing in DB row"


# --- TEST 2: PROPERTIES API CONTRACT ----------------------------------------


@pytest.mark.asyncio
async def test_properties_api_returns_rows() -> None:
    """
    Hit the /properties endpoint and confirm it returns a 200 with a JSON list
    whose items contain the expected keys.
    """
    backend = _get_backend_url()
    if not backend:
        pytest.skip("BACKEND_URL not set; skipping integration test (requires running backend).")

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{backend}/properties?limit=5")

    assert r.status_code == 200, f"/properties failed with {r.status_code}"

    data = r.json()
    # Back-compat: allow older deployments to return a raw list.
    if isinstance(data, list):
        items = data
        total = len(items)
    else:
        assert isinstance(data, dict), "API did not return a list or object"
        assert "items" in data and "total" in data, "API missing items/total"
        items = data.get("items")
        total = data.get("total")

        assert isinstance(items, list), "API items must be a list"
        assert isinstance(total, int), "API total must be an int"

    if items:
        sample = items[0]
        assert isinstance(sample, dict), "API list items must be objects"
        for col in REQUIRED_PROPERTIES_COLS:
            assert col in sample, f"Column '{col}' missing in API response"


# --- TEST 3: STRIPE WEBHOOK ENDPOINT CONTRACT -------------------------------


@pytest.mark.asyncio
async def test_stripe_webhook_endpoint_reachable() -> None:
    """
    Lightweight contract test for /stripe/webhook.

    Requires a running backend (set BACKEND_URL).
    """
    backend = _get_backend_url()
    if not backend:
        pytest.skip("BACKEND_URL not set; skipping integration test (requires running backend).")

    fake_event = {
        "type": "customer.subscription.updated",
        "data": {"object": {"customer": "cus_test_dummy"}},
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(f"{backend}/stripe/webhook", json=fake_event)

    assert r.status_code in (200, 204, 400), f"Unexpected status {r.status_code}"
