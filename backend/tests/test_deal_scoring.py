from backend.utils.deal_scoring import SCORE_VERSION, compute_deal_score


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
    assert breakdown.get("version") == SCORE_VERSION
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
    inputs = breakdown.get("inputs") or {}
    assert inputs.get("has_crime_index") is False
    assert inputs.get("crime_source") == "legacy_default"
    assert inputs.get("has_schools_rating") is False
    assert inputs.get("schools_source") == "legacy_default"
    assert inputs.get("has_rent_evidence") is False


def test_compute_deal_score_accepts_yield_and_roi_variants():
    score, breakdown = compute_deal_score(
        {
            "price": 375000,
            "yield": 6.5,
            "roi": 12,
            "rent": 1600,
        }
    )
    cats = breakdown.get("categories") or {}
    assert score > 0
    assert cats.get("yield", 0) > 0
    assert cats.get("roi", 0) > 0
    inputs = breakdown.get("inputs") or {}
    assert inputs.get("has_rent_evidence") is True


def test_compute_deal_score_marks_live_crime_and_schools_inputs():
    _score, breakdown = compute_deal_score(
        {
            "price": 250000,
            "yield_percent": 5.0,
            "rent": 1200,
            "crime_index": 0,
            "schools_rating": 0,
        }
    )
    inputs = breakdown.get("inputs") or {}
    assert inputs.get("has_crime_index") is True
    assert inputs.get("crime_source") == "provided"
    assert inputs.get("has_schools_rating") is True
    assert inputs.get("schools_source") == "provided"


def test_compute_deal_score_proxies_roi_from_yield_when_missing_roi():
    score, breakdown = compute_deal_score(
        {
            "price": 250000,
            "yield_percent": 5.0,
            "rent": 1200,
            "roi_percent": None,
        }
    )
    assert score > 0
    cats = breakdown.get("categories") or {}
    assert cats.get("yield", 0) > 0
    assert cats.get("roi", 0) > 0

    inputs = breakdown.get("inputs") or {}
    assert inputs.get("roi_source") == "proxy_yield"


def test_compute_deal_score_postcode_proxy_changes_score_when_missing_yield_and_rent():
    # With yield/roi/rent missing, postcode band should introduce score spread.
    base = {
        "price": 600000,
        "bedrooms": 2,
        "crime_index": 50,
        "schools_rating": 3,
    }

    central_score, central_breakdown = compute_deal_score({**base, "postcode": "SW1A 1AA"})
    outer_score, outer_breakdown = compute_deal_score({**base, "postcode": "E11 1AA"})

    assert central_score != outer_score

    central_cats = central_breakdown.get("categories") or {}
    outer_cats = outer_breakdown.get("categories") or {}

    assert central_cats.get("yield", 0) > 0
    assert outer_cats.get("yield", 0) > 0
    assert central_cats.get("price_to_rent", 0) > 0
    assert outer_cats.get("price_to_rent", 0) > 0
    assert central_cats.get("area_demand", 0) > 0
    assert outer_cats.get("area_demand", 0) > 0
