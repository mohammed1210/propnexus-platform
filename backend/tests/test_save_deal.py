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

    import backend.routes.save_deal as save_routes

    save_routes._SAVED_DEALS_HAS_CLERK_USER_ID = None
    save_routes._SAVED_DEALS_HAS_PROPERTY_ID = None
    save_routes._SAVED_DEALS_HAS_DATA = None
    save_routes._SAVED_DEALS_HAS_SAVED_AT = None
    save_routes._SAVED_DEALS_ACTION_COLUMNS = None
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


class _FakeQuery:
    def __init__(self, *, action_columns: bool = True):
        self.action_columns = action_columns
        self.select_cols = ""
        self.update_payload = None
        self.filters: list[tuple[str, object]] = []

    def select(self, cols: str):
        self.select_cols = cols
        return self

    def limit(self, _n: int):
        return self

    def update(self, payload: dict):
        self.update_payload = payload
        return self

    def eq(self, col: str, val):
        self.filters.append((col, val))
        return self

    def execute(self):
        if self.select_cols:
            if "deal_status" in self.select_cols and not self.action_columns:
                raise Exception("column saved_deals.deal_status does not exist")
            return _Result([])

        if self.update_payload is not None:
            filter_map = dict(self.filters)
            if (
                filter_map.get("property_id") == "prop-1"
                and filter_map.get("clerk_user_id") == "user_test"
            ):
                return _Result(
                    [{**self.update_payload, "property_id": "prop-1", "clerk_user_id": "user_test"}]
                )
            return _Result([])

        return _Result([])


class _FakeSupabase:
    def __init__(self, *, action_columns: bool = True):
        self.action_columns = action_columns

    def table(self, name: str):
        assert name == "saved_deals"
        return _FakeQuery(action_columns=self.action_columns)


def test_update_saved_deal_status_filters_by_current_user(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    resp = client.patch(
        "/saved-deals/status",
        headers=_trusted_headers(),
        json={"property_id": "prop-1", "status": "contacted"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    row = body["data"][0]
    assert row["property_id"] == "prop-1"
    assert row["clerk_user_id"] == "user_test"
    assert row["deal_status"] == "contacted"
    assert row["last_action_at"]
    assert row["contacted_at"]


def test_update_saved_deal_status_rejects_invalid_status(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    resp = client.patch(
        "/saved-deals/status",
        headers=_trusted_headers(),
        json={"property_id": "prop-1", "status": "made_up"},
    )

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid deal status"


def test_update_saved_deal_status_reports_missing_migration(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(
        save_routes, "_require_supabase", lambda: _FakeSupabase(action_columns=False), raising=True
    )

    resp = client.patch(
        "/saved-deals/status",
        headers=_trusted_headers(),
        json={"property_id": "prop-1", "status": "contacted"},
    )

    assert resp.status_code == 500
    assert "20260509_deal_action_fields.sql" in resp.json()["detail"]


def test_saved_deals_rejects_spoofed_clerk_header_without_internal_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    resp = client.get("/saved-deals", headers={"X-Clerk-User-Id": "user_test"})

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Unauthorized"


def test_saved_deals_rejects_unverified_jwt_without_internal_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    fake_jwt = "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyX3Rlc3QifQ.signature"
    resp = client.get("/saved-deals", headers={"Authorization": fake_jwt})

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Unauthorized"


def test_saved_deals_rejects_invalid_internal_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    resp = client.get(
        "/saved-deals",
        headers={
            "X-PropNexus-Internal-Token": "wrong-token",
            "X-PropNexus-User-Id": "user_test",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Unauthorized"


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("delete", "/save-deal?property_id=prop-1", {}),
        (
            "patch",
            "/saved-deals/status",
            {"json": {"property_id": "prop-1", "status": "contacted"}},
        ),
        ("delete", "/saved-deals/prop-1", {}),
        ("post", "/saved-deals/clear", {}),
    ],
)
def test_mutating_saved_deal_routes_reject_forged_identity_without_internal_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    kwargs: dict,
) -> None:
    import backend.routes.save_deal as save_routes

    monkeypatch.setattr(save_routes, "_require_supabase", lambda: _FakeSupabase(), raising=True)

    response = getattr(client, method)(path, headers={"X-Clerk-User-Id": "user_test"}, **kwargs)

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"
