import os

import pytest


@pytest.fixture
def app():
    from backend.main import app as fastapi_app

    return fastapi_app


def _has_real_supabase():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    # “example.supabase.co” is our placeholder; treat it as not real.
    if not url or "example.supabase.co" in url:
        return False
    return bool(key)


def pytest_collection_modifyitems(config, items):
    if _has_real_supabase():
        return

    skip_integration = pytest.mark.skip(
        reason="Supabase integration tests require real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
    )

    # These tests are the ones failing with ConnectError
    integration_keywords = (
        "schema_guard",
        "schema_contracts_guardrail",
        "properties_table_schema_contract",
        "properties_api_returns_rows",
        "stripe_webhook_endpoint_reachable",
    )

    for item in items:
        nodeid = item.nodeid
        if any(k in nodeid for k in integration_keywords):
            item.add_marker(skip_integration)
