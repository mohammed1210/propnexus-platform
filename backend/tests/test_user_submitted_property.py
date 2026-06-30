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


class _FakePropertySelectQuery:
    def __init__(self, row: dict[str, object]):
        self.row = row
        self.eq_filters: dict[str, str] = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key: str, value: str):
        self.eq_filters[key] = value
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self.eq_filters.get("id") == str(self.row.get("id")):
            return _Result(dict(self.row))
        return _Result(None)


class _FakeSupabase:
    def __init__(self):
        self.query = _FakeInsertQuery()

    def table(self, name: str):
        assert name == "properties"
        return self.query


class _FakeSupabaseForGet:
    def __init__(self, row: dict[str, object]):
        self.row = row

    def table(self, name: str):
        assert name == "properties"
        return _FakePropertySelectQuery(self.row)


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


def test_create_user_submitted_property_does_not_fetch_reference_url(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.properties_routes as property_routes

    fake = _FakeSupabase()
    monkeypatch.setattr(property_routes, "_get_supabase", lambda: fake, raising=True)

    class _FailIfUsedHttpClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("Reference URL must not be fetched in user-submitted flow")

    monkeypatch.setattr(property_routes.httpx, "Client", _FailIfUsedHttpClient, raising=True)

    response = client.post(
        "/properties/user-submitted",
        headers=_trusted_headers(),
        json={
            "source_url": "https://example.com/listing/99",
            "title": "No fetch expected",
            "location": "Leeds",
            "price": 199000,
        },
    )

    assert response.status_code == 200
    assert response.json().get("ok") is True


def test_get_property_allows_direct_access_for_user_submitted_row(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.properties_routes as property_routes

    manual_row = {
        "id": "prop_user_submitted",
        "title": "Manual row",
        "location": "Manchester",
        "source": "user_submitted",
        "price": 215000,
    }
    monkeypatch.setattr(
        property_routes,
        "_get_supabase",
        lambda: _FakeSupabaseForGet(manual_row),
        raising=True,
    )

    response = client.get("/properties/prop_user_submitted")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "prop_user_submitted"
    assert body["source"] == "user_submitted"
