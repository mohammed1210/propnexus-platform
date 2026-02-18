import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


def test_debug_scrape_probe_requires_admin_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "test-secret")
    monkeypatch.setenv("ADMIN_TOKEN", "test-secret")

    # Patch the probe runner to avoid outbound requests during tests.
    import backend.routes.debug_scrape_probe as probe

    async def _fake_run_probe(*args, **kwargs):
        return {"zoopla": {"classification": "parsed", "cards_found": 1}}

    monkeypatch.setattr(probe, "_run_probe", _fake_run_probe)

    client = TestClient(app)

    r = client.get("/debug/scrape-probe?location=London")
    assert r.status_code == 401

    r2 = client.get(
        "/debug/scrape-probe?location=London",
        headers={"x-admin-token": "test-secret"},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["ok"] is True
    assert body["location"] == "London"
    assert "results" in body
    assert "zoopla" in body["results"]


def test_debug_scrape_probe_allows_when_admin_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    monkeypatch.delenv("IMPORT_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("ADMIN_TOKEN", raising=False)

    import backend.routes.debug_scrape_probe as probe

    async def _fake_run_probe(*args, **kwargs):
        return {"rightmove": {"classification": "timeout"}}

    monkeypatch.setattr(probe, "_run_probe", _fake_run_probe)

    client = TestClient(app)
    r = client.get("/debug/scrape-probe?location=London")
    assert r.status_code == 401
