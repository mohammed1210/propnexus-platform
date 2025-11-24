import os
import pytest
from supabase import create_client
import httpx

# --- REQUIRED COLUMNS FOR PROPERTIES TABLE ---
REQUIRED_PROPERTIES_COLS = {
    "id",
    "title",
    "location",
    "price",
    "bedrooms",
    "bathrooms",
    "yield_percent",
    "roi_percent",
    "investment_type",
    "imageurl",
    "latitude",
    "longitude",
    "created_at",
}


# --- SUPABASE CLIENT ---
def get_sb_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        pytest.skip("Supabase not configured")
    return create_client(url, key)


# --- TEST 1: PROPERTIES TABLE HAS REQUIRED COLUMNS ---
@pytest.mark.asyncio
async def test_properties_table_schema_contract():
    sb = get_sb_client()
    res = sb.table("information_schema.columns").select("column_name").eq("table_name", "properties").execute()
    existing = {row["column_name"] for row in res.data}

    missing = REQUIRED_PROPERTIES_COLS - existing
    assert not missing, f"Missing expected columns in properties: {missing}"


# --- TEST 2: /properties API RETURNS AT LEAST 1 ROW ---
@pytest.mark.asyncio
async def test_properties_api_returns_rows():
    backend = os.environ.get("BACKEND_URL", "http://localhost:8000")
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{backend}/properties?limit=5")
        assert r.status_code == 200, f"/properties failed with {r.status_code}"
        data = r.json()
        assert isinstance(data, list), "/properties did not return a list"
        assert len(data) > 0, "Expected /properties to return rows, got empty list"

        # Ensure each object contains key fields
        sample = data[0]
        for col in REQUIRED_PROPERTIES_COLS:
            assert col in sample, f"Column '{col}' missing in API response"


# --- TEST 3: STRIPE WEBHOOK UPDATES USERS PLAN ---
@pytest.mark.asyncio
async def test_stripe_webhook_updates_plan(monkeypatch):
    """
    We simulate a Stripe webhook payload and confirm it updates the 'users' table.
    """

    # Arrange – mock Stripe event
    fake_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "customer": "cus_test123",
                "status": "active",
                "current_period_end": 1700000000,
            }
        }
    }

    backend = os.environ.get("BACKEND_URL", "http://localhost:8000")

    async with httpx.AsyncClient() as client:

        # Act – call webhook
        r = await client.post(f"{backend}/stripe/webhook", json=fake_event)
        assert r.status_code in (200, 204), f"Webhook returned {r.status_code}"

        # Assert – user updated in DB
        sb = get_sb_client()
        res = sb.table("users").select("*").eq("stripe_customer_id", "cus_test123").execute()

        assert len(res.data) == 1, "User not found after webhook update"
        user = res.data[0]
        assert user["plan"] in ("pro", "investor"), "Plan was not updated correctly"
        assert user["current_period_end"] == 1700000000, "current_period_end incorrect"
