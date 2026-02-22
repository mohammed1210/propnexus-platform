"""Comps endpoint should tolerate missing/partial DB fields.

The comps route is DB-backed and returns medians (no provider arrays).
"""


class _FakeResp:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._eq = {}
        self._limit = None

    def select(self, *_):
        return self

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        rows = self._rows
        for k, v in self._eq.items():
            rows = [r for r in rows if r.get(k) == v]
        if self._limit is not None:
            rows = rows[: self._limit]
        return _FakeResp(rows)


class _FakeSB:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "properties"
        return _FakeQuery(self._rows)


def test_comps_handles_missing_price_fields(monkeypatch):
    from backend.routes import comps_routes

    comps_routes.sb = _FakeSB(
        [
            {"postcode": "SW1A 1AA", "asking_price": 100_000, "rent_monthly": 1000},
            {"postcode": "SW1A 1AA", "price": None, "rent_monthly": 1500},
            {"postcode": "SW1A 1AA", "price": 300_000, "rent_monthly": 500},
        ]
    )

    r = comps_routes.get_comps("SW1A 1AA", request=None)
    assert r["source"] == "db"
    assert r["median_price"] == 200_000
    assert r["median_rent"] == 1000


def test_comps_handles_missing_rent_fields(monkeypatch):
    from backend.routes import comps_routes

    comps_routes.sb = _FakeSB(
        [
            {"postcode": "SW1A 1AA", "price": 100_000, "rent": 1000},
            {"postcode": "SW1A 1AA", "price": 200_000, "avg_rent": 1500},
            {"postcode": "SW1A 1AA", "price": 300_000, "rent_monthly": None},
        ]
    )

    r = comps_routes.get_comps("SW1A 1AA", request=None)
    assert r["source"] == "db"
    assert r["median_rent"] == 1250
