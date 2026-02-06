from backend.utils.listing_keys import extract_postcode


def test_extract_postcode_prefers_full_postcode_when_present():
    assert extract_postcode("10 Downing Street, London SW1A 2AA") == "SW1A2AA"
    assert extract_postcode("SW1A1AA") == "SW1A1AA"


def test_extract_postcode_outward_districts_work():
    assert extract_postcode("Battersea Church Road, London, SW11") == "SW11"
    assert extract_postcode("Pear Tree Street, London, EC1V") == "EC1V"
    assert extract_postcode("Hackney, London, E8") == "E8"
    assert extract_postcode("Mayfair, London, W1K") == "W1K"
    assert extract_postcode("Edinburgh EH7") == "EH7"
    assert extract_postcode("Glasgow G72") == "G72"
    assert extract_postcode("Manchester M1") == "M1"


def test_extract_postcode_does_not_grab_flat_numbers_like_1f2_or_3f2():
    # Must not return F2 from the flat number token.
    assert extract_postcode("25 (1F2) Dundee Terrace, Edinburgh EH11") == "EH11"
    assert extract_postcode("3F2, 79 Comely Bank Road, Stockbridge, Edinburgh EH4") == "EH4"

    # If there's no real postcode, we prefer returning None over a false positive.
    assert extract_postcode("Flat 1F2, no postcode given") is None
