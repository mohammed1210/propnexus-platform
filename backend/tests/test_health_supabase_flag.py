"""Regression tests for /health supabase_configured flag.

This must stay additive/backward-compatible and must not leak secrets.
"""

import pytest
from fastapi.testclient import TestClient

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
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "supabase_configured" in body
    assert isinstance(body["supabase_configured"], bool)
    assert body["supabase_configured"] is False

    # If configured, it should flip to True — but still never echo secrets.
    secret_key = "super-secret-service-role-key"
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", secret_key)

    resp2 = client.get("/health")
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2.get("supabase_configured") is True
    assert secret_key not in resp2.text
