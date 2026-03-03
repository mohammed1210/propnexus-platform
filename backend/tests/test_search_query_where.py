from __future__ import annotations

from backend.search.query import build_search_where


def test_build_search_where_includes_similarity_for_location_fields() -> None:
    where_sql, params = build_search_where({"q": "londn"}, include_similarity=True)

    assert "lower(coalesce(location, '')) LIKE :q" in where_sql
    assert "lower(coalesce(postcode, '')) LIKE :q" in where_sql
    assert "similarity(lower(coalesce(location, '')), :q_raw) >= 0.2" in where_sql
    assert "similarity(lower(coalesce(postcode, '')), :q_raw) >= 0.2" in where_sql
    assert "lower(coalesce(location, '')) % :q_raw" in where_sql
    assert "lower(coalesce(postcode, '')) % :q_raw" in where_sql
    assert "word_similarity(:loc_q_0, lower(coalesce(location, ''))) >= 0.55" in where_sql
    assert params["q"] == "%londn%"
    assert params["q_raw"] == "londn"
    assert params["loc_q_0"] == "londn"


def test_build_search_where_omits_similarity_when_disabled() -> None:
    where_sql, params = build_search_where({"q": "londn"}, include_similarity=False)

    assert "similarity(" not in where_sql
    assert " % :q_raw" not in where_sql
    assert "word_similarity(" not in where_sql
    assert params["q"] == "%londn%"
    assert "q_raw" not in params


def test_build_search_where_tokenizes_location_like_queries() -> None:
    where_sql, params = build_search_where({"q": "north londn"}, include_similarity=True)

    assert "lower(coalesce(location, '')) % :loc_q_0" in where_sql
    assert "lower(coalesce(location, '')) % :loc_q_1" in where_sql
    assert params["loc_q_0"] == "north"
    assert params["loc_q_1"] == "londn"
