from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_api_v1_search_ml_override_bypasses_flag(monkeypatch) -> None:
    from backend.routes import properties_routes

    # Flag off by default.
    monkeypatch.setattr(properties_routes.settings, "SMART_SEARCH_ML_RERANK", False)

    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: object())

    returned = [
        {"id": "a", "title": "one"},
        {"id": "b", "title": "two"},
        {"id": "c", "title": "three"},
    ]

    def _fake_search(_sb, query_text: str, *, top_k: int, enable_ml: bool):
        assert query_text == "flat london"
        assert top_k == 3
        assert enable_ml is True
        return list(reversed(returned))

    monkeypatch.setattr(properties_routes, "search_with_optional_rerank", _fake_search)

    res = client.get("/api/v1/search", params={"query": "flat london", "ml": "1", "k": 3})
    assert res.status_code == 200
    body = res.json()

    assert body["ml_enabled"] is True
    assert body["ids"] == ["c", "b", "a"]


def test_api_v1_search_respects_flag_when_ml_not_forced(monkeypatch) -> None:
    from backend.routes import properties_routes

    monkeypatch.setattr(properties_routes.settings, "SMART_SEARCH_ML_RERANK", False)
    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: object())

    def _fake_search(_sb, query_text: str, *, top_k: int, enable_ml: bool):
        assert query_text == "flat london"
        assert top_k == 2
        assert enable_ml is False
        return [{"id": "a"}, {"id": "b"}]

    monkeypatch.setattr(properties_routes, "search_with_optional_rerank", _fake_search)

    res = client.get("/api/v1/search", params={"query": "flat london", "k": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["ml_enabled"] is False
    assert body["ids"] == ["a", "b"]


def test_api_v1_search_post_returns_filtered_payload_shape(monkeypatch) -> None:
    from backend.routes import properties_routes

    monkeypatch.setattr(
        properties_routes,
        "query_db",
        lambda _payload: {
            "items": [{"id": "x1", "title": "Filtered item", "bedrooms": 3}],
            "total_results": 1,
        },
    )
    monkeypatch.setattr(
        properties_routes,
        "get_facets",
        lambda _payload: {
            "beds": {"1": 0, "2": 0, "3": 1, "4+": 0},
            "price": {"0-100k": 0, "100-200k": 0, "200-300k": 1, "300-500k": 0, "500k+": 0},
            "yield": {">=5%": 1, ">=7%": 0},
        },
    )

    payload = {
        "q": "london",
        "filters": {
            "beds": {"gte": 2, "lte": 4},
            "price": {"lte": 300000},
            "yield": {"gte": 0.05},
        },
    }
    res = client.post("/api/v1/search", json=payload)
    assert res.status_code == 200
    body = res.json()

    assert body["q"] == "london"
    assert body["count"] == 1
    assert body["total_results"] == 1
    assert body["items"][0]["id"] == "x1"
    assert body["facets"]["beds"]["3"] == 1
