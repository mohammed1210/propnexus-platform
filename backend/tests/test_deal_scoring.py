from backend.utils.deal_scoring import compute_deal_score


def test_compute_deal_score_bounds_and_int():
    score, breakdown = compute_deal_score(
        {
            "price": 250000,
            "yield_percent": 5.5,
            "roi_percent": 8.0,
            "rent": 1200,
        }
    )
    assert isinstance(score, int)
    assert 0 <= score <= 100
    assert isinstance(breakdown, dict)
    assert breakdown.get("version") == "v1.0"
    assert isinstance(breakdown.get("categories"), dict)


def test_compute_deal_score_preserves_zero_values():
    # crime_index=0 should NOT be defaulted to 50
    score, breakdown = compute_deal_score(
        {
            "price": 250000,
            "yield_percent": 5.0,
            "roi_percent": 8.0,
            "rent": 1200,
            "crime_index": 0,
            "schools_rating": 0,
        }
    )
    cats = breakdown.get("categories") or {}
    assert cats.get("crime_index_inverse") == 15.0
    assert cats.get("schools_access") == 0.0
    assert 0 <= score <= 100


def test_compute_deal_score_missing_data_safe_defaults():
    score, breakdown = compute_deal_score({})
    assert isinstance(score, int)
    assert 0 <= score <= 100
    cats = breakdown.get("categories") or {}
    # With defaults, these should be deterministic
    assert cats.get("crime_index_inverse") == 7.5
    assert cats.get("schools_access") == 9.0
