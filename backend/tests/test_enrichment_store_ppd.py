from __future__ import annotations

from types import SimpleNamespace

from backend.utils.enrichment_store import safe_select_ppd_sales


class _Query:
    def __init__(self, rows):
        self.rows = rows
        self.pattern = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        assert column == "postcode"
        self.pattern = value
        self.rows = [row for row in self.rows if str(row.get("postcode") or "") == value]
        return self

    def ilike(self, column, pattern):
        assert column == "postcode"
        self.pattern = pattern
        literal_prefix = str(pattern).replace("%", "").upper()
        self.rows = [
            row
            for row in self.rows
            if str(row.get("postcode") or "").upper().startswith(literal_prefix)
        ]
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, n):
        self.rows = self.rows[: int(n)]
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class _Supabase:
    def __init__(self, rows):
        self.query = _Query(rows)

    def table(self, name):
        assert name == "ppd_sales"
        return self.query


def test_safe_select_ppd_sales_matches_exact_outward_code_boundary():
    sb = _Supabase(
        [
            {"postcode": "RM1 1AA", "price": 300000},
            {"postcode": "RM10 1AA", "price": 310000},
            {"postcode": "RM11 1AA", "price": 320000},
        ]
    )

    rows = safe_select_ppd_sales(sb, postcode_prefix="RM1", limit=10, months_back=36)

    assert sb.query.pattern == "RM1 %"
    assert rows == [{"postcode": "RM1 1AA", "price": 300000}]


def test_safe_select_ppd_sales_can_match_full_postcode_exactly():
    sb = _Supabase(
        [
            {"postcode": "IG3 8AA", "price": 300000},
            {"postcode": "IG3 8AB", "price": 310000},
        ]
    )

    rows = safe_select_ppd_sales(
        sb, postcode_prefix="IG3 8AA", limit=10, months_back=36, match_mode="exact"
    )

    assert sb.query.pattern == "IG3 8AA"
    assert rows == [{"postcode": "IG3 8AA", "price": 300000}]


def test_safe_select_ppd_sales_can_match_postcode_sector():
    sb = _Supabase(
        [
            {"postcode": "IG3 8AA", "price": 300000},
            {"postcode": "IG3 8AB", "price": 310000},
            {"postcode": "IG3 9AA", "price": 320000},
        ]
    )

    rows = safe_select_ppd_sales(
        sb, postcode_prefix="IG3 8", limit=10, months_back=36, match_mode="sector"
    )

    assert sb.query.pattern == "IG3 8%"
    assert rows == [
        {"postcode": "IG3 8AA", "price": 300000},
        {"postcode": "IG3 8AB", "price": 310000},
    ]
