from backend.utils.deal_scoring import _postcode_band, compute_deal_score


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

    assert breakdown["version"] == "v1.2"
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

    assert breakdown["version"] == "v1.2"
    assert breakdown.get("inputs", {}).get("postcode_band") in {"central", "outer", "other"}
    assert breakdown.get("inputs", {}).get("rent_source") == "proxy"
    assert score != 16


def test_postcode_band_outward_tokens_map_central_and_outer():
    assert _postcode_band({"title": "Studio flat, EC1V"}) == "central"
    assert _postcode_band({"location": "London W1K"}) == "central"
    assert _postcode_band({"title": "Nice place (SW11)"}) == "outer"
    assert _postcode_band({"title": "Chelsea SW3 / near river"}) == "outer"
    assert _postcode_band({"title": "Hackney, E8."}) == "outer"


def test_proxy_rent_triggers_with_outward_tokens_in_text_fields():
    # Ensure the fallback extraction works even when outward code is embedded in text.
    score, breakdown = compute_deal_score(
        {
            "price": 700000,
            "bedrooms": 2,
            "title": "Modern 2 bed apartment (W1K), great transport",
            "yield_percent": None,
            "roi_percent": None,
            # rent intentionally missing
        }
    )

    assert breakdown["version"] == "v1.2"
    assert breakdown.get("inputs", {}).get("postcode_band") == "central"
    assert breakdown.get("inputs", {}).get("rent_source") == "proxy"
    assert score != 16
