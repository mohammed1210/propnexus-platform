import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


def test_debug_endpoints_hidden_in_production_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("ENABLE_DEBUG_ENDPOINTS", raising=False)

    client = TestClient(app)

    assert client.get("/debug/routes").status_code == 404
    assert client.get("/debug/supabase-env").status_code == 404
    assert client.get("/debug/scraper-env").status_code == 404

    # Router-level debug endpoint should also be gated.
    assert client.get("/debug/scrape-probe?location=London").status_code == 404


def test_debug_endpoints_allow_in_production_when_explicitly_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ENABLE_DEBUG_ENDPOINTS", "1")

    client = TestClient(app)

    r = client.get("/debug/routes")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] > 0
    assert "/debug/routes" in body["paths"]

    # This endpoint still requires admin auth inside the handler.
    r2 = client.get("/debug/scrape-probe?location=London")
    assert r2.status_code == 401
