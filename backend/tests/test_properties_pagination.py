from __future__ import annotations

from typing import Any, List, Tuple

from starlette.responses import Response

import backend.routes.properties_routes as properties_routes


class _FakeResult:
    def __init__(self, data: Any, count: int):
        self.data = data
        self.count = count


class _FakeQuery:
    def __init__(self):
        self.calls: List[Tuple[str, tuple, dict]] = []

    def select(self, *args, **kwargs):
        self.calls.append(("select", args, kwargs))
        return self

    def eq(self, *args, **kwargs):
        self.calls.append(("eq", args, kwargs))
        return self

    def gte(self, *args, **kwargs):
        self.calls.append(("gte", args, kwargs))
        return self

    def lte(self, *args, **kwargs):
        self.calls.append(("lte", args, kwargs))
        return self

    def in_(self, *args, **kwargs):
        self.calls.append(("in_", args, kwargs))
        return self

    def or_(self, *args, **kwargs):
        self.calls.append(("or_", args, kwargs))
        return self

    def order(self, *args, **kwargs):
        self.calls.append(("order", args, kwargs))
        return self

    def range(self, *args, **kwargs):
        self.calls.append(("range", args, kwargs))
        return self

    def execute(self):
        # Return 2 items but an overall total larger than the page.
        return _FakeResult(
            data=[
                {"id": "1", "title": "A", "created_at": "2024-01-01T00:00:00Z"},
                {"id": "2", "title": "B", "created_at": "2024-01-02T00:00:00Z"},
            ],
            count=1234,
        )


class _FakeSupabase:
    def __init__(self, query: _FakeQuery):
        self._query = query

    def table(self, name: str):
        assert name == "properties"
        return self._query


def test_list_properties_returns_paginated_shape_and_total(monkeypatch):
    fake_query = _FakeQuery()
    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: _FakeSupabase(fake_query))

    res = properties_routes.list_properties(
        response=Response(),
        q=None,
        source=None,
        created_after=None,
        min=None,
        max=None,
        beds=None,
        baths=None,
        types=None,
        limit=50,
        offset=0,
        sort="created_at_desc",
        dir="desc",
    )

    assert isinstance(res, dict)
    assert set(res.keys()) >= {"items", "total", "limit", "offset", "has_more"}
    assert isinstance(res["items"], list)
    assert res["total"] == 1234
    assert res["limit"] == 50
    assert res["offset"] == 0
    assert res["has_more"] is True

    # Ensure we requested an exact count and used range pagination.
    assert any(
        c[0] == "select" and c[1] == ("*",) and c[2].get("count") == "exact"
        for c in fake_query.calls
    )
    assert any(c[0] == "range" and c[1] == (0, 49) for c in fake_query.calls)
