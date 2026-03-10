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


def test_served_by_field(monkeypatch) -> None:
    from backend.routes import properties_routes

    monkeypatch.setattr(properties_routes.settings, "SEARCH_INSTANCE", "blue")
    monkeypatch.setattr(
        properties_routes,
        "query_db",
        lambda _payload: {
            "items": [{"id": "x1", "title": "A"}],
            "total_results": 1,
        },
    )
    monkeypatch.setattr(properties_routes, "get_facets", lambda _payload: {})

    body = client.post("/api/v1/search", json={"q": "london", "filters": {}}).json()
    assert body["served_by"] in ("blue", "green", "local")
