from __future__ import annotations

from backend.utils.recommended_ranker import normalize_deal_type, rerank_recommended


def _row(
    pid: str,
    *,
    created_at: str,
    score: int,
    categories: dict,
    rent_source: str = "provided",
) -> dict:
    return {
        "id": pid,
        "created_at": created_at,
        "score": score,
        "score_breakdown": {
            "version": "test",
            "score": score,
            "categories": categories,
            "inputs": {
                "rent_source": rent_source,
            },
        },
    }


def test_normalize_deal_type_defaults_to_balanced():
    assert normalize_deal_type(None) == "balanced"
    assert normalize_deal_type("") == "balanced"
    assert normalize_deal_type("nope") == "balanced"


def test_rerank_recommended_persona_changes_order():
    cashflow_heavy = _row(
        "cash",
        created_at="2025-01-02T00:00:00Z",
        score=70,
        categories={
            "yield": 20.0,
            "roi": 15.0,
            "price_to_rent": 12.0,
            "area_demand": 5.0,
            "crime_index_inverse": 5.0,
            "schools_access": 5.0,
        },
    )
    growth_heavy = _row(
        "growth",
        created_at="2025-01-03T00:00:00Z",
        score=70,
        categories={
            "yield": 6.0,
            "roi": 6.0,
            "price_to_rent": 6.0,
            "area_demand": 15.0,
            "crime_index_inverse": 15.0,
            "schools_access": 15.0,
        },
    )

    cashflow_ranked = rerank_recommended(
        [cashflow_heavy, growth_heavy],
        deal_type="cashflow",
        min_tier2=1,
    )
    assert cashflow_ranked[0]["id"] == "cash"

    growth_ranked = rerank_recommended(
        [cashflow_heavy, growth_heavy],
        deal_type="growth",
        min_tier2=1,
    )
    assert growth_ranked[0]["id"] == "growth"


def test_rerank_recommended_penalizes_missing_rent_source():
    good = _row(
        "good",
        created_at="2025-01-03T00:00:00Z",
        score=70,
        categories={
            "yield": 12.0,
            "roi": 12.0,
            "price_to_rent": 10.0,
            "area_demand": 10.0,
            "crime_index_inverse": 10.0,
            "schools_access": 10.0,
        },
        rent_source="provided",
    )
    missing = _row(
        "missing",
        created_at="2025-01-04T00:00:00Z",
        score=70,
        categories={
            "yield": 12.0,
            "roi": 12.0,
            "price_to_rent": 10.0,
            "area_demand": 10.0,
            "crime_index_inverse": 10.0,
            "schools_access": 10.0,
        },
        rent_source="missing",
    )

    ranked = rerank_recommended([missing, good], deal_type="balanced", min_tier2=1)
    assert ranked[0]["id"] == "good"
    assert "recommended_score" in ranked[0]
    assert "deal_reasons" in ranked[0]


def test_rerank_recommended_tiebreaks_by_created_at_newer_first():
    a = _row(
        "a",
        created_at="2025-01-01T00:00:00Z",
        score=70,
        categories={
            "yield": 12.0,
            "roi": 12.0,
            "price_to_rent": 10.0,
            "area_demand": 10.0,
            "crime_index_inverse": 10.0,
            "schools_access": 10.0,
        },
        rent_source="provided",
    )
    b = _row(
        "b",
        created_at="2025-02-01T00:00:00Z",
        score=70,
        categories={
            "yield": 12.0,
            "roi": 12.0,
            "price_to_rent": 10.0,
            "area_demand": 10.0,
            "crime_index_inverse": 10.0,
            "schools_access": 10.0,
        },
        rent_source="provided",
    )

    ranked = rerank_recommended([a, b], deal_type="balanced", min_tier2=1)
    assert ranked[0]["id"] == "b"
