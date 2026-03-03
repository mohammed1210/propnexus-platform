from __future__ import annotations

import json
from pathlib import Path

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


def test_api_v1_search_post_logs_search_query_metrics(monkeypatch) -> None:
    from backend.routes import properties_routes

    inserted_rows: list[dict] = []

    class _FakeTable:
        def insert(self, row):
            inserted_rows.append(row)
            return self

        def execute(self):
            return type("Res", (), {"data": [{"ok": True}]})()

    class _FakeSchema:
        def table(self, _name):
            return _FakeTable()

    class _FakeSB:
        def schema(self, _name):
            return _FakeSchema()

        def table(self, _name):
            return _FakeTable()

    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: _FakeSB())


def test_api_v1_search_post_typo_query_returns_results_with_fixture(monkeypatch) -> None:
    from backend.routes import properties_routes

    fixture_path = Path(__file__).parent / "fixtures" / "search_guardrail_rows.json"
    rows = json.loads(fixture_path.read_text(encoding="utf-8"))

    def _fake_query_db(payload):
        q = str(payload.get("q") or "").strip().lower()
        if q == "londn":
            return {"items": [rows[0]], "total_results": 1}
        return {"items": [], "total_results": 0}

    monkeypatch.setattr(properties_routes, "query_db", _fake_query_db)
    monkeypatch.setattr(properties_routes, "get_facets", lambda _payload: {})

    res = client.post("/api/v1/search", json={"q": "londn", "allow_broaden": False, "filters": {}})
    assert res.status_code == 200
    body = res.json()
    assert body["total_results"] == 1
    assert body["items"][0]["location"] == "London"


def test_api_v1_search_post_london_and_typo_both_return_results(monkeypatch) -> None:
    from backend.routes import properties_routes

    fixture_path = Path(__file__).parent / "fixtures" / "search_guardrail_rows.json"
    rows = json.loads(fixture_path.read_text(encoding="utf-8"))

    def _fake_query_db(payload):
        q = str(payload.get("q") or "").strip().lower()
        if q in {"london", "londn"}:
            return {"items": rows[:2], "total_results": 2}
        return {"items": [], "total_results": 0}

    monkeypatch.setattr(properties_routes, "query_db", _fake_query_db)
    monkeypatch.setattr(properties_routes, "get_facets", lambda _payload: {})

    for term in ("london", "londn"):
        res = client.post("/api/v1/search", json={"q": term, "allow_broaden": False, "filters": {}})
        assert res.status_code == 200
        body = res.json()
        assert body["total_results"] > 0
        assert len(body["items"]) > 0


def test_api_v1_search_post_allow_broaden_false_skips_fallback(monkeypatch) -> None:
    from backend.routes import properties_routes

    broaden_called = {"value": False}

    monkeypatch.setattr(
        properties_routes,
        "query_db",
        lambda _payload: {
            "items": [],
            "total_results": 0,
        },
    )
    monkeypatch.setattr(properties_routes, "get_facets", lambda _payload: {})

    def _fake_broaden(_filters):
        broaden_called["value"] = True
        return {}, {}

    monkeypatch.setattr(properties_routes, "broaden", _fake_broaden)

    res = client.post(
        "/api/v1/search",
        json={
            "q": "londn",
            "allow_broaden": False,
            "filters": {"price": {"lte": 250000}},
        },
    )

    assert res.status_code == 200
    body = res.json()
    assert body.get("broadened") is not True
    assert body["count"] == 0
    assert broaden_called["value"] is False


def test_expand_query_terms_includes_synonyms() -> None:
    from backend.search.query import expand_query_terms

    terms = expand_query_terms("flat")
    assert "flat" in terms
    assert "apartment" in terms
