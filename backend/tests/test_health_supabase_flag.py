"""Regression tests for /health supabase_configured flag."""

import pytest
from fastapi.testclient import TestClient

from backend.utils.supabase_env import resolve_supabase_config

try:
    from backend.main import app  # type: ignore

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None  # type: ignore[assignment]
    _import_error = e


def test_health_includes_supabase_configured_boolean(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "supabase_configured" in body
    assert isinstance(body["supabase_configured"], bool)
    assert body["supabase_configured"] is False

    # Legacy fallback vars are ignored by backend config parsing.
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://legacy.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "legacy_key")
    resp_legacy = client.get("/health")
    assert resp_legacy.status_code == 200
    assert resp_legacy.json().get("supabase_configured") is False

    # If configured, it should flip to True — but still never echo secrets.
    secret_key = "super-secret-service-role-key"
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", secret_key)

    resp2 = client.get("/health")
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2.get("supabase_configured") is True
    assert secret_key not in resp2.text


def test_health_accepts_legacy_service_key_aliases(monkeypatch: pytest.MonkeyPatch) -> None:
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "legacy-service-key")
    resp_service_key = client.get("/health")
    assert resp_service_key.status_code == 200
    assert resp_service_key.json().get("supabase_configured") is True

    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_KEY", "legacy-generic-key")
    resp_generic_key = client.get("/health")
    assert resp_generic_key.status_code == 200
    assert resp_generic_key.json().get("supabase_configured") is True


def test_supabase_config_normalizes_copied_env_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", '"SUPABASE_URL=fake.supabase.co"')
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    cfg = resolve_supabase_config()

    assert cfg is not None
    assert cfg.url == "https://fake.supabase.co"
    assert cfg.key == "service-role-key"
