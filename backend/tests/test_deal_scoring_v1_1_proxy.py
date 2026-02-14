from backend.utils.deal_scoring import SCORE_VERSION, compute_deal_score


def test_v1_1_proxy_rent_used_when_missing_yield_roi_and_rent():
    score, breakdown = compute_deal_score(
        {
            "price": 650000,
            "bedrooms": 2,
            "title": "Modern flat for sale SW11 3AA near Clapham Junction",
            "yield_percent": None,
            "roi_percent": None,
            # rent intentionally missing
        }
    )

    assert breakdown["version"] == SCORE_VERSION
    assert breakdown.get("inputs", {}).get("rent_source") in {"proxy", "provided"}
    assert breakdown.get("inputs", {}).get("rent_source") != "missing"

    # Old behavior tended to cluster around ~16 with defaults.
    assert score != 16
    assert score > 16


def test_v1_1_proxy_rent_used_for_outward_only_postcode():
    score, breakdown = compute_deal_score(
        {
            "price": 650000,
            "bedrooms": 2,
            "postcode": "SW11",
            "yield_percent": None,
            "roi_percent": None,
        }
    )

    assert breakdown["version"] == SCORE_VERSION
    assert breakdown.get("inputs", {}).get("postcode_band") in {"central", "outer", "other"}
    assert breakdown.get("inputs", {}).get("rent_source") == "proxy"
    assert score != 16
