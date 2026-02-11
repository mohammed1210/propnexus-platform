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
