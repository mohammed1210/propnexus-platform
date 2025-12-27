import os  # noqa: E402

from dotenv import load_dotenv

load_dotenv()
from typing import List

import httpx
import pytest  # noqa: E402
from supabase import Client, create_client  # noqa: E402


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
    assert (
        SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    ), "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for schema tests"
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


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
    backend = os.environ.get("BACKEND_URL", "http://localhost:8000")

    async with httpx.AsyncClient() as client:
        r = await client.get(f"{backend}/properties?limit=5")

    assert r.status_code == 200, f"/properties failed with {r.status_code}"

    data = r.json()
    assert isinstance(data, list), "API did not return a list"

    if data:
        sample = data[0]
        assert isinstance(sample, dict), "API list items must be objects"
        for col in REQUIRED_PROPERTIES_COLS:
            assert col in sample, f"Column '{col}' missing in API response"


# --- TEST 3: STRIPE WEBHOOK ENDPOINT CONTRACT -------------------------------


@pytest.mark.asyncio
async def test_stripe_webhook_endpoint_reachable() -> None:
    """
    Lightweight contract test for /stripe/webhook.

    In real production this endpoint expects a signed Stripe event.
    When we hit it from CI/local with a dummy payload it's OK for it to
    return 400 (no signature) – we mainly care that:

      * The route exists (not 404), and
      * It doesn't blow up (not 500).

    Therefore we only assert that the status code is in (200, 204, 400)
    and we deliberately DO NOT assert any DB side-effects here.
    """
    backend = os.environ.get("BACKEND_URL", "http://localhost:8000")

    fake_event = {
        "type": "customer.subscription.updated",
        "data": {"object": {"customer": "cus_test_dummy"}},
    }

    async with httpx.AsyncClient() as client:
        r = await client.post(f"{backend}/stripe/webhook", json=fake_event)

    assert r.status_code in (200, 204, 400), f"Unexpected status {r.status_code}"
