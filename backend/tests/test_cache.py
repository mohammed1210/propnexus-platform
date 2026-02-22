import importlib
import types

import pytest

# We import the routes modules and monkeypatch their get_supabase() to use a
# fake supabase client backed by an in-memory table.


class FakeSBTable:
    def __init__(self, storage):
        self.storage = storage
        self._tbl = None
        self._eq = {}
        self._order = None
        self._limit = None
        self._ilike = {}
        self._like = {}

    # supabase-py style chainers
    def select(self, *_):
        return self

    def table(self, name):
        self._tbl = name
        return self

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def ilike(self, col, pattern):
        self._ilike[col] = pattern
        return self

    def like(self, col, pattern):
        self._like[col] = pattern
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def upsert(self, row):
        self.storage.setdefault(self._tbl, []).append(row)

        class R:
            data = [row]

        return R()

    def execute(self):
        rows = self.storage.get(self._tbl, [])

        if self._order:
            col, desc = self._order
            rows = sorted(rows, key=lambda r: r.get(col) or "", reverse=desc)

        # apply eq filter when present
        for k, v in self._eq.items():
            rows = [r for r in rows if r.get(k) == v]

        def _match_like(val: str, pattern: str, *, case_insensitive: bool) -> bool:
            if not isinstance(val, str) or not isinstance(pattern, str):
                return False
            v = val
            p = pattern
            if case_insensitive:
                v = v.lower()
                p = p.lower()
            if p.endswith("%"):
                return v.startswith(p[:-1])
            return v == p

        for k, p in self._ilike.items():
            rows = [r for r in rows if _match_like(r.get(k), p, case_insensitive=True)]
        for k, p in self._like.items():
            rows = [r for r in rows if _match_like(r.get(k), p, case_insensitive=False)]

        class R:
            pass

        r = R()
        setattr(r, "data", rows[: (self._limit or len(rows))])
        return r


class FakeSB:
    def __init__(self, storage):
        self.storage = storage
        self._t = FakeSBTable(storage)

    def table(self, name):
        self._t._tbl = name
        self._t._eq = {}
        self._t._order = None
        self._t._limit = None
        self._t._ilike = {}
        self._t._like = {}
        return self._t


@pytest.fixture()
def fake_env(monkeypatch):
    storage = {}
    sb = FakeSB(storage)
    comps_routes = importlib.import_module("backend.routes.comps_routes")
    area_intel_routes = importlib.import_module("backend.routes.area_intel_routes")

    monkeypatch.setattr(comps_routes, "sb", sb, raising=True)
    monkeypatch.setattr(area_intel_routes, "get_supabase", lambda: sb, raising=True)

    return types.SimpleNamespace(
        storage=storage,
        comps_routes=comps_routes,
        area_intel_routes=area_intel_routes,
    )


def test_comps_db_postcode_median(fake_env):
    fake_env.storage["properties"] = [
        {"postcode": "SW1A 1AA", "price": 100_000, "rent_monthly": 1000},
        {"postcode": "SW1A 1AA", "price": 200_000, "rent_monthly": 1500},
        {"postcode": "SW1A 1AA", "price": 300_000, "rent_monthly": 500},
    ]

    r = fake_env.comps_routes.get_comps("SW1A 1AA", request=None)
    assert r["source"] == "db"
    assert r["match_level"] == "postcode"
    assert r["count"] == 3
    assert r["median_price"] == 200_000
    assert r["median_rent"] == 1000


def test_comps_db_outward_fallback(fake_env):
    fake_env.storage["properties"] = [
        {"postcode": "SW1A 1AA", "price": 100_000, "rent_monthly": 900},
        {"postcode": "SW1A 2BB", "price": 400_000, "rent_monthly": 1100},
    ]

    r = fake_env.comps_routes.get_comps("SW1A 9ZZ", request=None)
    assert r["source"] == "db"
    assert r["match_level"] == "outward"
    assert r["count"] == 2
    assert r["median_price"] == 250_000


def test_area_intel_db_postcode_median(fake_env):
    fake_env.storage["properties"] = [
        {"postcode": "SW1A 1AA", "price": 100_000, "rent_monthly": 1000, "yield_percent": 4.0},
        {"postcode": "SW1A 1AA", "price": 200_000, "rent_monthly": 1500, "yield_percent": 6.0},
        {"postcode": "SW1A 1AA", "price": 300_000, "rent_monthly": 500, "yield_percent": 10.0},
    ]

    r = fake_env.area_intel_routes.get_area_intel("SW1A 1AA", request=None)
    assert r["source"] == "db"
    assert r["match_level"] == "postcode"
    assert r["count"] == 3
    assert r["median_price"] == 200_000
    assert r["median_rent"] == 1000
    assert r["median_yield_percent"] == 6.0


def test_area_intel_empty_returns_null_medians(fake_env):
    fake_env.storage["properties"] = []

    r = fake_env.area_intel_routes.get_area_intel("SW1A 1AA", request=None)
    assert r["source"] == "db"
    assert r["count"] == 0
    assert r["median_price"] is None
    assert r["median_rent"] is None
    assert r["median_yield_percent"] is None
