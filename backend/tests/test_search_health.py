from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_search_skips_when_postgres_not_detected(monkeypatch) -> None:
    from backend.routes import search_health

    monkeypatch.setattr(search_health, "is_postgres_detected", lambda: False)

    res = client.get("/health/search")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "skipped"
    assert body["similarity_available"] is False
