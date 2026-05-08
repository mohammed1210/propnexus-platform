from __future__ import annotations

from types import SimpleNamespace

from backend.utils.enrichment_store import safe_select_ppd_sales


class _Query:
    def __init__(self, rows):
        self.rows = rows
        self.pattern = None

    def select(self, *_args, **_kwargs):
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
