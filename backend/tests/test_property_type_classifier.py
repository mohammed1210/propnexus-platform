from backend.utils.deal_signals import extract_deal_signals
from backend.utils.property_type_classifier import classify_property_type


def test_property_type_terraced_from_title():
    pt, raw = classify_property_type(
        title="3 bed terraced house for sale",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "Terraced"
    assert raw == ""


def test_property_type_semi_detached_from_raw():
    pt, raw = classify_property_type(
        title=None,
        description=None,
        raw_type="Semi Detached House",
        extra=None,
    )
    assert pt == "Semi-detached"
    assert raw == "Semi Detached House"


def test_property_type_bungalow_beats_detached():
    pt, _raw = classify_property_type(
        title="Detached bungalow",
        description="Lovely detached bungalow",
        raw_type=None,
        extra=None,
    )
    assert pt == "Bungalow"


def test_property_type_studio_beats_apartment():
    pt, _raw = classify_property_type(
        title="Studio apartment",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "Studio"


def test_property_type_block_of_flats_is_hmo_block():
    pt, _raw = classify_property_type(
        title="Block of flats investment",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "HMO/Block"


def test_property_type_commercial_unit_is_commercial():
    pt, _raw = classify_property_type(
        title="Commercial unit",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "Commercial"


def test_property_type_building_plot_is_land():
    pt, _raw = classify_property_type(
        title="Building plot / land",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "Land"


def test_property_type_maisonette():
    pt, _raw = classify_property_type(
        title="Maisonette",
        description=None,
        raw_type=None,
        extra=None,
    )
    assert pt == "Maisonette"


def test_property_type_noise_community_not_commercial_unit():
    pt, _raw = classify_property_type(
        title="Great community amenities",
        description="A vibrant community feel",
        raw_type=None,
        extra=None,
    )
    assert pt == "Other"


def test_normalised_property_type_semi_detached_from_description():
    out = classify_property_type(
        {
            "title": "3 bedroom house for sale",
            "description": "A well-presented semi-detached family home",
        }
    )
    assert out["normalised_property_type"] == "semi_detached"
    assert out["property_type_source"] == "description"
    assert "semi-detached" in out["matched_type_terms"]


def test_normalised_property_type_prefers_flat_title_over_apartment_description():
    out = classify_property_type(
        {
            "title": "2 bedroom flat for sale",
            "description": "A bright apartment with balcony",
        }
    )
    assert out["normalised_property_type"] == "flat"
    assert out["property_type_source"] == "title"


def test_normalised_property_type_ignores_detached_garage_false_positive():
    out = classify_property_type({"description": "Detached garage to rear"})
    assert out["normalised_property_type"] != "detached"


def test_normalised_property_type_ignores_semi_rural_false_positive():
    out = classify_property_type({"description": "Semi-rural location"})
    assert out["normalised_property_type"] != "semi_detached"


def test_deal_signal_keywords_include_modernisation_and_chain_free():
    out = extract_deal_signals({"description": "In need of modernisation and offered chain free"})
    assert "needs_refurb" in out["signals"]
    assert "chain_free" in out["signals"]
    assert "modernisation" in out["deal_keywords"]
    assert "chain free" in out["deal_keywords"]
    assert any(signal["type"] == "value_add" for signal in out["investment_signals"])
