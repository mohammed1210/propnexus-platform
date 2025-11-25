"""
Schema contract guardrail tests.

Goal:
- Catch schema mismatches between backend expectations and Supabase tables
  BEFORE deploy.

This test uses the Supabase SERVICE ROLE key, so it should be run in:
- Codespaces / local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
- CI with the same env vars set
"""

import os
import pytest
from supabase import create_client, Client
from postgrest.exceptions import APIError

# Import the backend contract for properties directly
from routes.properties_routes import SELECT_COLS as PROPERTIES_SELECT_COLS  # type: ignore


def get_sb_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        pytest.skip("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; skipping schema guardrail tests")

    return create_client(url, key)


@pytest.mark.asyncio
async def test_properties_select_cols_match_table_schema():
    """
    Ensure that all columns referenced in SELECT_COLS for /properties
    actually exist in the Supabase `properties` table.

    If a column is renamed or missing in DB, this test will fail with a
    clear APIError rather than causing 500s in production.
    """
    sb = get_sb_client()

    # SELECT_COLS is a comma-separated string like:
    # "id,title,location,price,bedrooms,bathrooms,..." etc.
    raw_cols = [c.strip() for c in PROPERTIES_SELECT_COLS.split(",") if c.strip()]
    select_str = ",".join(raw_cols)

    try:
        # We only need to check that Supabase accepts the column list.
        # Limit 1 to keep the query light.
        res = sb.table("properties").select(select_str).limit(1).execute()
    except APIError as e:
        pytest.fail(
            f"Schema mismatch for 'properties' table.\n"
            f"SELECT_COLS = {raw_cols}\n"
            f"Supabase error: {e}"
        )

    # If we get here, the query succeeded and all columns exist.
    assert isinstance(res.data, list)


@pytest.mark.asyncio
async def test_users_table_has_billing_columns():
    """
    Guardrail: ensure `users` table has the billing/subscription columns
    that the backend expects (stripe_webhook.py, users_routes.py).

    Required columns:
      - email
      - stripe_customer_id
      - plan
      - plan_status
      - current_period_end
    """
    sb = get_sb_client()

    # Fetch 1 row; if table is empty, we still check the JSON keys from PostgREST's shape.
    try:
        res = sb.table("users").select("*").limit(1).execute()
    except APIError as e:
        pytest.fail(f"Failed to query users table: {e}")

    # If no data, we can't reliably check keys – skip but warn.
    if not res.data:
        pytest.skip("users table is empty; cannot verify billing columns")

    row = res.data[0]
    required = ["email", "stripe_customer_id", "plan", "plan_status", "current_period_end"]
    missing = [c for c in required if c not in row]

    assert not missing, f"users table missing required billing columns: {missing}"


@pytest.mark.asyncio
async def test_scrape_runs_table_has_observability_columns():
    """
    Guardrail: ensure `scrape_runs` table has the columns required by
    the new RunLog / observability system.

    Adjust the list if your migration adds/removes fields, but keep this
    aligned with backend/tasks/ingestion_runner.py and observability code.
    """
    sb = get_sb_client()

    try:
        res = sb.table("scrape_runs").select("*").limit(1).execute()
    except APIError as e:
        pytest.fail(f"Failed to query scrape_runs table: {e}")

    if not res.data:
        pytest.skip("scrape_runs table is empty; cannot verify observability columns")

    row = res.data[0]

    required = [
        "id",
        "source",
        "mode",              # added by 20251119_add_mode_to_scrape_runs.sql
        "location",
        "status",
        "properties_found",
        "duration_ms",
        "error_message",
        "created_at",
    ]

    missing = [c for c in required if c not in row]

    assert not missing, f"scrape_runs table missing observability columns: {missing}"
    