from backend.utils.deal_scoring import SCORE_VERSION, compute_deal_score


def test_proxy_rent_triggers_for_postcode_district_without_rent_yield_roi():
    score, breakdown = compute_deal_score(
        {
            "price": 550000,
            "bedrooms": 2,
            "postcode": "SW11",
            "yield_percent": None,
            "roi_percent": None,
            # rent intentionally missing
        }
    )

    assert breakdown["version"] == SCORE_VERSION
    assert breakdown.get("inputs", {}).get("rent_source") == "proxy"
    assert breakdown.get("inputs", {}).get("postcode_band") in {"central", "outer"}
    assert breakdown.get("inputs", {}).get("rent_monthly", 0) > 0
    assert score != 16
