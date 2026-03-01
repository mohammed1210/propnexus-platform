from __future__ import annotations

from typing import Any

from backend.search.query import _postgres_url, build_search_where, is_postgres_detected

EMPTY_FACETS = {
    "beds": {"1": 0, "2": 0, "3": 0, "4+": 0},
    "price": {
        "0-100k": 0,
        "100-200k": 0,
        "200-300k": 0,
        "300-500k": 0,
        "500k+": 0,
    },
    "yield": {">=5%": 0, ">=7%": 0},
}


def _coerce_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def get_facets(payload: dict[str, Any]) -> dict[str, dict[str, int]]:
    if not is_postgres_detected():
        return {k: dict(v) for k, v in EMPTY_FACETS.items()}

    try:
        from sqlalchemy import create_engine, text
    except Exception:
        return {k: dict(v) for k, v in EMPTY_FACETS.items()}

    where_sql, params = build_search_where(payload if isinstance(payload, dict) else {})

    stmt = text(
        f"""
        WITH filtered AS (
            SELECT bedrooms, price, COALESCE(yield, yield_percent) AS yield_value
            FROM properties
            WHERE {where_sql}
        )
        SELECT
            SUM(CASE WHEN bedrooms = 1 THEN 1 ELSE 0 END) AS beds_1,
            SUM(CASE WHEN bedrooms = 2 THEN 1 ELSE 0 END) AS beds_2,
            SUM(CASE WHEN bedrooms = 3 THEN 1 ELSE 0 END) AS beds_3,
            SUM(CASE WHEN bedrooms >= 4 THEN 1 ELSE 0 END) AS beds_4p,
            SUM(CASE WHEN price >= 0 AND price < 100000 THEN 1 ELSE 0 END) AS price_0_100,
            SUM(CASE WHEN price >= 100000 AND price < 200000 THEN 1 ELSE 0 END) AS price_100_200,
            SUM(CASE WHEN price >= 200000 AND price < 300000 THEN 1 ELSE 0 END) AS price_200_300,
            SUM(CASE WHEN price >= 300000 AND price < 500000 THEN 1 ELSE 0 END) AS price_300_500,
            SUM(CASE WHEN price >= 500000 THEN 1 ELSE 0 END) AS price_500_plus,
            SUM(CASE WHEN yield_value >= 0.05 THEN 1 ELSE 0 END) AS yield_5,
            SUM(CASE WHEN yield_value >= 0.07 THEN 1 ELSE 0 END) AS yield_7
        FROM filtered
        """
    )

    engine = create_engine(_postgres_url(), future=True)
    try:
        with engine.connect() as conn:
            row = conn.execute(stmt, params).mappings().first()
    except Exception:
        return {k: dict(v) for k, v in EMPTY_FACETS.items()}
    finally:
        try:
            engine.dispose()
        except Exception:
            pass

    if row is None:
        return {k: dict(v) for k, v in EMPTY_FACETS.items()}

    return {
        "beds": {
            "1": _coerce_int(row.get("beds_1")),
            "2": _coerce_int(row.get("beds_2")),
            "3": _coerce_int(row.get("beds_3")),
            "4+": _coerce_int(row.get("beds_4p")),
        },
        "price": {
            "0-100k": _coerce_int(row.get("price_0_100")),
            "100-200k": _coerce_int(row.get("price_100_200")),
            "200-300k": _coerce_int(row.get("price_200_300")),
            "300-500k": _coerce_int(row.get("price_300_500")),
            "500k+": _coerce_int(row.get("price_500_plus")),
        },
        "yield": {
            ">=5%": _coerce_int(row.get("yield_5")),
            ">=7%": _coerce_int(row.get("yield_7")),
        },
    }
