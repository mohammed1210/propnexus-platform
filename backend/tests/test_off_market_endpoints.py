import os
import uuid

import pytest
from fastapi.testclient import TestClient

# Import your FastAPI app
from backend.main import app

client = TestClient(app)


def _supabase_configured() -> bool:
    return bool(
        (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"))
        and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY"))
    )


def _admin_headers():
    """
    Your routes accept either:
    - Authorization: Bearer <token>
    - X-API-Key: <token>

    We'll try Bearer first.
    """
    token = (
        os.getenv("OFF_MARKET_ADMIN_TOKEN", "")
        or os.getenv("IMPORT_ADMIN_TOKEN", "")
        or os.getenv("ADMIN_TOKEN", "")
        or os.getenv("API_KEY", "")
    )
    if not token:
        # If no token in test env, we skip tests that require admin auth.
        pytest.skip("Admin token not set in test environment")
    return {"Authorization": f"Bearer {token}"}


def _random_location():
    return f"TestCity-{uuid.uuid4().hex[:8]}"


def test_get_off_market_list_returns_200_and_json():
    if not _supabase_configured():
        pytest.skip("Supabase not configured")
    res = client.get("/off-market?limit=5")
    assert res.status_code == 200
    data = res.json()
    # Should be a list
    assert isinstance(data, list)


def test_create_off_market_accepts_legacy_keys_and_returns_row():
    headers = _admin_headers()
    if not _supabase_configured():
        pytest.skip("Supabase not configured")
    location = _random_location()

    payload = {
        "title": "Test Off Market Deal",
        "location": location,
        # Legacy keys supported now:
        "asking_price": 123456,
        "contact_email": "test@example.com",
        "description": "Test description",
        # Image key variants:
        "image_url": "https://example.com/test.jpg",
        # Also acceptable: imageurl
        "investment_type": "HMO",
        "bedrooms": 3,
        "bathrooms": 1,
        "source": "manual",
    }

    res = client.post("/off-market/create", json=payload, headers=headers)
    assert res.status_code in (200, 201)

    row = res.json()
    # Expect an inserted record with id
    assert "id" in row
    assert row.get("location") == location
    # image_url normalized + score computed
    assert row.get("image_url") or row.get("imageurl")
    assert isinstance(row.get("score"), int)


def test_get_off_market_filtered_by_location_returns_results():
    if not _supabase_configured():
        pytest.skip("Supabase not configured")
    # This test relies on the prior create test inserting a unique location.
    # We'll just fetch latest list and pick a location if present.
    res = client.get("/off-market?limit=20")
    assert res.status_code == 200
    rows = res.json()
    assert isinstance(rows, list)

    if not rows:
        pytest.skip("No off-market rows available to filter on")

    location = rows[0].get("location")
    if not location:
        pytest.skip("Row missing location; cannot test filter")

    res2 = client.get(f"/off-market?limit=10&location={location}")
    assert res2.status_code == 200
    rows2 = res2.json()
    assert isinstance(rows2, list)

    # Every returned row should match filter location (case sensitivity depends on backend)
    for r in rows2:
        assert str(location).lower() in str(r.get("location", "")).lower()


def test_get_off_market_by_id_returns_row_or_404():
    if not _supabase_configured():
        pytest.skip("Supabase not configured")
    # Fetch at least one row, then call /off-market/{id}
    res = client.get("/off-market?limit=10")
    assert res.status_code == 200
    rows = res.json()

    if not rows:
        pytest.skip("No off-market rows exist; cannot test GET by id")

    lead_id = rows[0].get("id")
    if not lead_id:
        pytest.skip("Row missing id")

    res2 = client.get(f"/off-market/{lead_id}")
    assert res2.status_code == 200
    row = res2.json()
    assert row.get("id") == lead_id


def test_get_off_market_by_id_invalid_uuid_returns_422_never_500():
    bad_id = "not-a-uuid"
    res = client.get(f"/off-market/{bad_id}")
    assert res.status_code == 422


def test_generate_off_market_inserts_and_returns_ids():
    if not _supabase_configured():
        pytest.skip("Supabase not configured")

    payload = {
        "location": _random_location(),
        "budget": 250000,
        "count": 2,
        "investment_type": "HMO",
    }
    res = client.post("/off-market/generate-off-market", json=payload)
    assert res.status_code == 200
    body = res.json()
    leads = body.get("leads") or body.get("deals")
    assert isinstance(leads, list)
    assert len(leads) >= 1
    assert "id" in leads[0]
    assert "created_at" in leads[0]

    lead_id = leads[0]["id"]
    # Should be fetchable
    res2 = client.get(f"/off-market/{lead_id}")
    assert res2.status_code == 200
    assert res2.json().get("id") == lead_id


def test_admin_backfill_scores_requires_token_when_configured(monkeypatch):
    # Backfill should be admin-only when a token is configured.
    # We monkeypatch the module-level ADMIN_TOKEN so this is testable in CI.
    from backend.routes import off_market_routes

    monkeypatch.setattr(off_market_routes, "ADMIN_TOKEN", "test-token")

    res = client.post("/off-market/admin/backfill-scores")
    assert res.status_code == 401


def test_admin_backfill_scores_allows_token_but_may_500_without_supabase(monkeypatch):
    from backend.routes import off_market_routes

    monkeypatch.setattr(off_market_routes, "ADMIN_TOKEN", "test-token")

    res = client.post(
        "/off-market/admin/backfill-scores?limit=1",
        headers={"Authorization": "Bearer test-token"},
    )

    # If Supabase isn't configured in this environment, the route returns 500.
    if not _supabase_configured():
        assert res.status_code == 500
    else:
        assert res.status_code == 200


def test_admin_backfill_scores_updates_zero_score_rows():
    if not _supabase_configured():
        pytest.skip("Supabase not configured")

    headers = _admin_headers()

    from postgrest.exceptions import APIError

    from supabase import create_client

    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    assert url and key
    sb = create_client(url, key)

    test_id = str(uuid.uuid4())
    location = _random_location()

    try:
        # Insert a legacy-style row with score=0 so backfill should update it.
        # This requires the polish migration (score column) to be present.
        try:
            sb.table("off_market_leads").insert(
                {"id": test_id, "title": "Backfill Test", "location": location, "score": 0}
            ).execute()
        except APIError as e:
            # If schema isn't migrated (missing score column), skip cleanly.
            if getattr(e, "code", None) == "PGRST204":
                pytest.skip("off_market_leads.score column not available in this environment")
            raise

        res = client.post("/off-market/admin/backfill-scores?limit=200", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "attempted" in body
        assert "updated" in body

        res_get = client.get(f"/off-market/{test_id}")
        assert res_get.status_code == 200
        row = res_get.json()
        assert row.get("id") == test_id
        assert int(row.get("score") or 0) != 0
    finally:
        # Cleanup best-effort
        try:
            sb.table("off_market_leads").delete().eq("id", test_id).execute()
        except Exception:
            pass
