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

@pytest.mark.parametrize("table,columns", REQUIRED_COLUMNS.items())
def test_required_columns_exist(table, columns):
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    sb = create_client(url, key)

    res = sb.table(table).select("*").limit(1).execute()

    existing = set(res.data[0].keys()) if res.data else set()

    missing = [c for c in columns if c not in existing]

    assert not missing, f"Missing columns in {table}: {missing}"
    