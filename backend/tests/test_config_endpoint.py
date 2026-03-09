"""Tests for /config endpoint."""

import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


def test_config_reports_missing_supabase_env(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    resp = client.get("/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["supabase"]["configured"] is False
    assert body["supabase"]["db_reachable"] is False
    assert body["supabase"]["required_vars"] == ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    assert "SUPABASE_URL" in body["supabase"]["missing_vars"]
    assert "SUPABASE_SERVICE_ROLE_KEY" in body["supabase"]["missing_vars"]


def test_config_reports_ok_when_probe_is_healthy(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    import backend.utils.supabase_health as supabase_health

    secret_key = "test-super-secret-key"
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", secret_key)
    monkeypatch.setattr(
        supabase_health,
        "probe_supabase",
        lambda: supabase_health.SupabaseProbeResult(
            configured=True,
            required_vars=("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"),
            missing_vars=(),
            db_reachable=True,
            detail="Supabase configured and reachable.",
        ),
    )

    client = TestClient(app)
    resp = client.get("/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["supabase"]["configured"] is True
    assert body["supabase"]["db_reachable"] is True
    assert secret_key not in resp.text

