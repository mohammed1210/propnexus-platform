import importlib
import types
from datetime import datetime, timedelta, timezone

import pytest

# We will import the routes modules and monkeypatch their sb + providers.


class FakeSBTable:
    def __init__(self, storage):
        self.storage = storage
        self._tbl = None
        self._eq = {}
        self._order = None
        self._limit = None

    # supabase-py style chainers
    def select(self, *_):
        return self

    def table(self, name):
        self._tbl = name
        return self

    def eq(self, col, val):
        self._eq[col] = val
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
        # emulate latest-first by fetched_at
        rows = self.storage.get(self._tbl, [])
        col, desc = self._order if self._order else ("fetched_at", True)
        rows = sorted(rows, key=lambda r: r.get(col) or "", reverse=desc)
        # apply eq filter when present
        for k, v in self._eq.items():
            rows = [r for r in rows if r.get(k) == v]

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
        return self._t


@pytest.fixture()
def fake_env(monkeypatch):
    storage = {}
    sb = FakeSB(storage)
    # Patch sb into both route modules after import
    comps_routes = importlib.import_module("backend.routes.comps_routes")
    area_routes = importlib.import_module("backend.routes.area_routes")

    monkeypatch.setattr(comps_routes, "sb", sb, raising=True)
    monkeypatch.setattr(area_routes, "sb", sb, raising=True)

    # Patch providers to deterministic fakes counting calls
    calls = {"comps": 0, "area": 0}

    def comps_provider(pc: str):
        calls["comps"] += 1
        return {"postcode": pc, "sales": [], "rents": []}

    def area_provider(k: str):
        calls["area"] += 1
        return {"key": k, "population": 1}

    monkeypatch.setattr(
        importlib.import_module("backend.routes.comps_routes"),
        "get_comps_from_provider",
        comps_provider,
        raising=True,
    )
    monkeypatch.setattr(
        importlib.import_module("backend.routes.area_routes"),
        "get_area_intel_from_provider",
        area_provider,
        raising=True,
    )

    return types.SimpleNamespace(
        storage=storage,
        calls=calls,
        comps_routes=comps_routes,
        area_routes=area_routes,
    )


def test_comps_cache_miss_then_hit(fake_env):
    r = fake_env.comps_routes.get_comps("SW1A 1AA", request=None)
    assert r["source"] == "provider"
    assert fake_env.calls["comps"] == 1

    r2 = fake_env.comps_routes.get_comps("SW1A 1AA", request=None)
    assert r2["source"] == "cache"
    assert fake_env.calls["comps"] == 1  # no additional provider call


def test_area_cache_miss_then_hit(fake_env):
    r = fake_env.area_routes.get_area_intel("SW1A", request=None)
    assert r["source"] == "provider"
    assert fake_env.calls["area"] == 1

    r2 = fake_env.area_routes.get_area_intel("SW1A", request=None)
    assert r2["source"] == "cache"
    assert fake_env.calls["area"] == 1


def test_stale_refresh(fake_env, monkeypatch):
    # make cached fetched_at older than 24h
    storage = fake_env.storage
    old_ts = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    storage.setdefault("comps_cache", []).append(
        {"postcode": "N1", "payload": {"postcode": "N1"}, "fetched_at": old_ts}
    )
    r = fake_env.comps_routes.get_comps("N1", request=None)
    assert r["source"] == "provider"
    # provider called at least once
    assert fake_env.calls["comps"] >= 1
