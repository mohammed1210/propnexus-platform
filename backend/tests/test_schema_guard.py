# backend/tests/test_schema_guard.py

import os

import pytest

from supabase import create_client

REQUIRED_COLUMNS = {
    "properties": [
        "id",
        "title",
        "price",
        "bedrooms",
        "bathrooms",
        "description",
        "location",
        "latitude",
        "longitude",
        "yield_percent",
        "roi_percent",
        "imageurl",
        "investment_type",
    ]
}


def _get_supabase_creds() -> tuple[str | None, str | None]:
    return os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


@pytest.mark.parametrize("table,columns", REQUIRED_COLUMNS.items())
def test_required_columns_exist(table, columns):
    url, key = _get_supabase_creds()
    if not url or not key:
        pytest.skip(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; skipping Supabase schema guard test."
        )

    sb = create_client(url, key)

    # If the table has 0 rows, res.data can be empty – don’t crash
    res = sb.table(table).select("*").limit(1).execute()

    existing = set(res.data[0].keys()) if res.data else set()

    # If there are no rows, we can’t infer schema from row keys.
    # In that case, treat the test as skipped rather than a failure.
    if not existing:
        pytest.skip(
            f"No rows in {table}; cannot infer columns from data. Seed 1 row to enforce this check."
        )

    missing = [c for c in columns if c not in existing]
    assert not missing, f"Missing columns in {table}: {missing}"
