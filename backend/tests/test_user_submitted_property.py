from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("PROPNEXUS_INTERNAL_API_TOKEN", "test-internal-token")
    return TestClient(app)


def _trusted_headers(user_id: str = "user_test") -> dict[str, str]:
    return {
        "X-PropNexus-Internal-Token": "test-internal-token",
        "X-PropNexus-User-Id": user_id,
        "X-Clerk-User-Id": user_id,
    }


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeInsertQuery:
    def __init__(self):
        self.payload = None

    def insert(self, payload: dict):
        self.payload = payload
        return self

    def execute(self):
        row = dict(self.payload)
        row["id"] = "prop_user_submitted"
        return _Result([row])


class _FakeSupabase:
    def __init__(self):
        self.query = _FakeInsertQuery()

    def table(self, name: str):
        assert name == "properties"
        return self.query


def test_create_user_submitted_property_uses_reference_url_only(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.properties_routes as property_routes

    fake = _FakeSupabase()
    monkeypatch.setattr(property_routes, "_get_supabase", lambda: fake, raising=True)

    response = client.post(
        "/properties/user-submitted",
        headers=_trusted_headers(),
        json={
            "source_url": "https://example.com/listing/42",
            "title": "Investor deal",
            "location": "Manchester",
            "postcode": "M1 1AA",
            "price": 225000,
            "bedrooms": 2,
            "bathrooms": 1,
            "property_type": "Flat",
            "estimated_monthly_rent": 1350,
            "description": "User submitted notes",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["property_id"] == "prop_user_submitted"

    payload = fake.query.payload
    assert payload is not None
    assert payload["source"] == "user_submitted"
    assert payload["source_url"] == "https://example.com/listing/42"
    assert payload["data"]["user_provided_reference_only"] is True
    assert payload["data"]["rent_monthly"] == 1350
