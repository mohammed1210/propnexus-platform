from backend.utils.deal_scoring import SCORE_VERSION, _postcode_band, compute_deal_score


def test_postcode_band_fallback_detects_outward_codes_with_punctuation():
    assert _postcode_band({"postcode": "SW11"}) == "outer"
    assert _postcode_band({"postcode": "SW3"}) == "outer"
    assert _postcode_band({"postcode": "W1K"}) == "central"
    assert _postcode_band({"postcode": "EC1V"}) == "central"
    assert _postcode_band({"postcode": "E8"}) == "outer"

    assert _postcode_band({"title": "Battersea Church Road, London, SW11"}) == "outer"
    assert _postcode_band({"location": "Upper Brook Street, London, W1K,"}) == "central"
    assert _postcode_band({"title": "Nice place (SW11)"}) == "outer"
    assert _postcode_band({"title": "Chelsea SW3 / near river"}) == "outer"
    assert _postcode_band({"title": "Hackney, E8."}) == "outer"


def test_compute_deal_score_uses_proxy_rent_when_band_present_in_text_fields():
    score, breakdown = compute_deal_score(
        {
            "price": 700000,
            "bedrooms": 3,
            "title": "Modern 3 bed apartment (W1K), great transport",
            "yield_percent": None,
            "roi_percent": None,
            # rent intentionally missing
        }
    )

    assert breakdown["version"] == SCORE_VERSION
    assert breakdown.get("inputs", {}).get("postcode_band") == "central"
    assert breakdown.get("inputs", {}).get("rent_source") == "proxy"
    assert score != 16
