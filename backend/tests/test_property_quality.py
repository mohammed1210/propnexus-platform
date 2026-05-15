from backend.utils.ingest import normalize_record
from backend.utils.property_quality import (
    build_quality_patch,
    extract_best_postcode,
    normalize_source_value,
)


def test_full_postcode_extracted_and_normalised():
    match = extract_best_postcode({"location": "Flat near London SW1A1AA"})
    assert match.value == "SW1A 1AA"
    assert match.quality == "full"
    assert match.source == "location"


def test_outward_code_extracted_when_full_missing():
    match = extract_best_postcode({"description": "Victorian terrace in N22 near transport"})
    assert match.value == "N22"
    assert match.quality == "outward"


def test_full_postcode_is_not_downgraded():
    patch = build_quality_patch(
        {
            "id": "p1",
            "postcode": "SW1A 1AA",
            "location": "N22",
            "source": "Rightmove",
            "data": {},
        }
    )
    assert patch.get("postcode") is None
    assert patch["source"] == "rightmove"


def test_imageurl_backfilled_and_image_urls_deduped():
    patch = build_quality_patch(
        {
            "id": "p1",
            "imageurl": None,
            "image_urls": ["//img/1.jpg", "https://img/1.jpg", "https://img/2.jpg", ""],
            "data": {},
        }
    )
    assert patch["imageurl"] == "https://img/1.jpg"
    assert patch["image_urls"] == ["https://img/1.jpg", "https://img/2.jpg"]


def test_source_values_normalised():
    assert normalize_source_value("Rightmove") == "rightmove"
    assert normalize_source_value("rm") == "rightmove"
    assert normalize_source_value("Zoopla") == "zoopla"


def test_normalize_record_adds_postcode_metadata_without_scraperapi():
    out = normalize_record(
        {"title": "Auction flat", "location": "Manchester M1 1AE", "price": "£120,000"},
        source="Zoopla",
    )
    assert out["source"] == "zoopla"
    assert out["postcode"] == "M1 1AE"
    assert out["data"]["postcode_quality"] == "full"
