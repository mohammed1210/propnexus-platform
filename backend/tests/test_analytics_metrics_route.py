from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class _FakeTable:
    def __init__(self, data: dict[str, list[dict]], name: str):
        self._data = data
        self._name = name

    def select(self, _cols: str):
        return self

    def gte(self, _key: str, _value: str):
        return self

    def execute(self):
        return type("Res", (), {"data": list(self._data.get(self._name, []))})()


class _FakeSchema:
    def __init__(self, data: dict[str, list[dict]]):
        self._data = data

    def table(self, name: str):
        return _FakeTable(self._data, name)


class _FakeSB:
    def __init__(self, data: dict[str, list[dict]]):
        self._data = data

    def schema(self, _name: str):
        return _FakeSchema(self._data)

    def table(self, name: str):
        return _FakeTable(self._data, name)


def test_analytics_metrics_aggregates_7d_values(monkeypatch) -> None:
    from backend.routes import analytics_metrics

    now = datetime.now(timezone.utc).isoformat()
    fake = _FakeSB(
        {
            "search_queries": [
                {"query": "londn", "results_count": 0, "created_at": now},
                {"query": "londn", "results_count": 0, "created_at": now},
                {"query": "london", "results_count": 3, "created_at": now},
            ],
            "search_clicks": [{"id": "1", "created_at": now}, {"id": "2", "created_at": now}],
        }
    )

    monkeypatch.setattr(analytics_metrics, "require_admin", lambda _request: None)
    monkeypatch.setattr(analytics_metrics, "require_sb", lambda: fake)

    res = client.get("/analytics/metrics")
    assert res.status_code == 200

    body = res.json()
    assert body["searches_total"] == 3
    assert body["zero_results_rate"] == 0.6667
    assert body["ctr"] == 0.6667
    assert body["top_zero_result_queries"][0] == {"query": "londn", "count": 2}
