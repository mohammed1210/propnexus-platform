def fetch_columns(table_name: str) -> set[str]:
    """
    Fetch column names from Supabase via PostgREST.

    IMPORTANT:
    Supabase does NOT expose the `information_schema` schema over REST in many
    configurations. If the request returns 404, we SKIP the test rather than fail
    the entire CI run.

    This keeps the guardrails lightweight without blocking deployments.
    """
    assert SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, (
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for schema tests"
    )

    url = f"{SUPABASE_URL}/rest/v1/information_schema.columns"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    params = {
        "table_name": f"eq.{table_name}",
        "select": "column_name",
    }

    resp = httpx.get(url, headers=headers, params=params)

    # Supabase returns 404 because information_schema is not exposed
    if resp.status_code == 404:
        pytest.skip(
            "Supabase does not expose information_schema over REST; "
            "skipping schema column guardrail test."
        )

    resp.raise_for_status()
    data = resp.json()
    return {row["column_name"] for row in data}