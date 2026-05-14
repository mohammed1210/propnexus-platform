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


class _FilteringResult:
    def __init__(self, data: Any, count: int | None = None):
        self.data = data
        self.count = count


class _FilteringQuery:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = rows
        self._source_eq: str | None = None
        self._exclude_spareroom = False
        self._range: tuple[int, int] | None = None
        self._orders: list[tuple[str, bool]] = []
        self.calls: List[Tuple[str, tuple, dict]] = []

    def select(self, *args, **kwargs):
        self.calls.append(("select", args, kwargs))
        return self

    def eq(self, *args, **kwargs):
        self.calls.append(("eq", args, kwargs))
        if args and args[0] == "source":
            self._source_eq = str(args[1]).lower()
        return self

    def neq(self, *args, **kwargs):
        self.calls.append(("neq", args, kwargs))
        if args == ("source", "spareroom"):
            self._exclude_spareroom = True
        return self

    def or_(self, *args, **kwargs):
        self.calls.append(("or_", args, kwargs))
        if args and args[0] == "source.is.null,source.neq.spareroom":
            self._exclude_spareroom = True
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

    def order(self, *args, **kwargs):
        self.calls.append(("order", args, kwargs))
        self._orders.append((str(args[0]), bool(kwargs.get("desc", False))))
        return self

    def range(self, *args, **kwargs):
        self.calls.append(("range", args, kwargs))
        self._range = (int(args[0]), int(args[1]))
        return self

    def execute(self):
        rows = list(self._rows)
        if self._source_eq is not None:
            rows = [r for r in rows if str(r.get("source") or "").lower() == self._source_eq]
        elif self._exclude_spareroom:
            rows = [r for r in rows if str(r.get("source") or "").lower() != "spareroom"]

        def _sort_value(row: dict[str, Any], column: str):
            value = row.get(column)
            return (value is None, value)

        for column, desc in reversed(self._orders):
            rows.sort(key=lambda row, col=column: _sort_value(row, col), reverse=desc)

        total = len(rows)
        if self._range is not None:
            start, end = self._range
            rows = rows[start : end + 1]
        return _FilteringResult(rows, total)


class _FilteringSupabase:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = rows
        self.queries: list[_FilteringQuery] = []

    def table(self, name: str):
        if name != "properties":
            return _FilteringQuery([])
        query = _FilteringQuery(self._rows)
        self.queries.append(query)
        return query


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
    assert set(res.keys()) >= {"items", "total", "mappable_count", "limit", "offset", "has_more"}
    assert isinstance(res["items"], list)
    assert res["total"] == 1234
    assert isinstance(res["mappable_count"], int)
    assert res["limit"] == 50
    assert res["offset"] == 0
    assert res["has_more"] is True

    # Ensure we requested an exact count and used range pagination.
    assert any(
        c[0] == "select" and c[1] == ("*",) and c[2].get("count") == "exact"
        for c in fake_query.calls
    )
    assert any(c[0] == "range" and c[1] == (0, 49) for c in fake_query.calls)


def test_list_properties_excludes_spareroom_before_pagination_count_and_points(monkeypatch):
    rows = [
        {
            "id": f"spare-{idx}",
            "title": f"SpareRoom {idx}",
            "source": "spareroom",
            "price": 400 + idx,
            "created_at": f"2026-05-{idx + 1:02d}T00:00:00Z",
            "latitude": 51.0,
            "longitude": -0.1,
        }
        for idx in range(30)
    ] + [
        {
            "id": "rightmove-1",
            "title": "Rightmove public listing",
            "source": "rightmove",
            "price": 150000,
            "created_at": "2026-05-20T00:00:00Z",
            "latitude": 52.0,
            "longitude": -1.0,
        },
        {
            "id": "zoopla-1",
            "title": "Zoopla public listing",
            "source": "zoopla",
            "price": 175000,
            "created_at": "2026-05-19T00:00:00Z",
            "latitude": 53.0,
            "longitude": -2.0,
        },
        {
            "id": "unknown-1",
            "title": "Unknown source public listing",
            "source": None,
            "price": 200000,
            "created_at": "2026-05-18T00:00:00Z",
            "latitude": 54.0,
            "longitude": -3.0,
        },
    ]
    fake_sb = _FilteringSupabase(rows)
    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: fake_sb)

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
        limit=25,
        offset=0,
        sort="price_asc",
        dir="desc",
        include_points=True,
        points_limit=100,
    )

    assert res["total"] == 3
    assert [item["id"] for item in res["items"]] == [
        "rightmove-1",
        "zoopla-1",
        "unknown-1",
    ]
    assert all(str(item.get("source") or "").lower() != "spareroom" for item in res["items"])
    assert res["points"] is not None
    assert {point["id"] for point in res["points"]} == {
        "rightmove-1",
        "zoopla-1",
        "unknown-1",
    }
    assert res["has_more"] is False


def test_list_properties_allows_explicit_spareroom_opt_in_and_source(monkeypatch):
    rows = [
        {"id": "spare-1", "title": "SpareRoom", "source": "spareroom", "price": 400},
        {"id": "rightmove-1", "title": "Rightmove", "source": "rightmove", "price": 150000},
    ]
    fake_sb = _FilteringSupabase(rows)
    monkeypatch.setattr(properties_routes, "_get_supabase", lambda: fake_sb)

    included = properties_routes.list_properties(
        response=Response(),
        q=None,
        source=None,
        created_after=None,
        min=None,
        max=None,
        beds=None,
        baths=None,
        types=None,
        limit=25,
        offset=0,
        sort="price_asc",
        dir="desc",
        include_spareroom=True,
    )
    assert included["total"] == 2
    assert [item["id"] for item in included["items"]] == ["spare-1", "rightmove-1"]

    spare_only = properties_routes.list_properties(
        response=Response(),
        q=None,
        source="spareroom",
        created_after=None,
        min=None,
        max=None,
        beds=None,
        baths=None,
        types=None,
        limit=25,
        offset=0,
        sort="price_asc",
        dir="desc",
    )
    assert spare_only["total"] == 1
    assert [item["id"] for item in spare_only["items"]] == ["spare-1"]
