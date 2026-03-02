from __future__ import annotations

from backend.search.query import build_search_where


def test_build_search_where_includes_similarity_for_location_fields() -> None:
    where_sql, params = build_search_where({"q": "londn"}, include_similarity=True)

    assert "lower(coalesce(location, '')) LIKE :q" in where_sql
    assert "lower(coalesce(postcode, '')) LIKE :q" in where_sql
    assert "similarity(lower(coalesce(location, '')), :q_raw) >= 0.2" in where_sql
    assert "similarity(lower(coalesce(postcode, '')), :q_raw) >= 0.2" in where_sql
    assert params["q"] == "%londn%"
    assert params["q_raw"] == "londn"


def test_build_search_where_omits_similarity_when_disabled() -> None:
    where_sql, params = build_search_where({"q": "londn"}, include_similarity=False)

    assert "similarity(" not in where_sql
    assert params["q"] == "%londn%"
    assert "q_raw" not in params
