from backend.scraper.rightmove_scraper import (
    _build_rightmove_find_url,
    _pick_location_identifier_from_typeahead,
    normalize_location_identifier,
)


def test_rightmove_typeahead_picks_first_allowed_type():
    payload = [
        {"displayName": "Manchester", "type": "BOGUS", "locationIdentifier": "BOGUS^1"},
        {"displayName": "Manchester", "type": "CITY", "locationIdentifier": "CITY^123"},
        {"displayName": "Manchester", "type": "REGION", "locationIdentifier": "REGION^999"},
    ]

    ident = _pick_location_identifier_from_typeahead(payload)
    assert ident == "CITY^123"


def test_rightmove_typeahead_tolerates_wrapped_payload():
    payload = {
        "results": [
            {"type": "TOWN", "locationIdentifier": "TOWN^555"},
        ]
    }

    ident = _pick_location_identifier_from_typeahead(payload)
    assert ident == "TOWN^555"


def test_rightmove_find_url_builds_index_offsets():
    assert normalize_location_identifier("REGION%5E87490") == "REGION^87490"
    assert normalize_location_identifier("REGION%255E87490") == "REGION^87490"

    url0 = _build_rightmove_find_url("REGION%5E87490", index=0)
    url1 = _build_rightmove_find_url("REGION^87490", index=24)

    assert "locationIdentifier=REGION^87490" in url0
    assert "index=0" in url0
    assert "index=24" in url1
    assert "includeSSTC=false" in url0
