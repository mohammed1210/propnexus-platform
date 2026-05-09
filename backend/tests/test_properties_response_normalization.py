from backend.routes.properties_routes import _normalize_property_row


def test_normalize_property_row_hydrates_and_normalizes_urls():
    row = {
        "source": "spareroom",
        "location": None,
        "address": "Birmingham",
        "price": None,
        "imageurl": None,
        "image_urls": [
            "//photos2.spareroom.co.uk/images/flatshare/listings/unmodified/98/19/98191732.jpg"
        ],
        "data": {
            "raw": {
                "location": "Birmingham",
                "image_url": "//photos2.spareroom.co.uk/images/flatshare/listings/unmodified/98/19/98191732.jpg",
                "price": None,
            }
        },
    }

    out = _normalize_property_row(row)

    assert out["location"] == "Birmingham"
    assert out["address"] == "Birmingham"
    assert out["image_urls"][0].startswith("https://")
    # imageurl should be usable (either from raw or from image_urls)
    assert out["imageurl"]
    assert out["imageurl"].startswith("https://")


def test_normalize_property_row_image_urls_none_returns_empty_list():
    out = _normalize_property_row({"id": "1", "image_urls": None, "imageurl": None})
    assert isinstance(out.get("image_urls"), list)
    assert out["image_urls"] == []


def test_normalize_property_row_image_urls_json_string_is_parsed():
    out = _normalize_property_row(
        {
            "id": "2",
            "image_urls": '["https://a.example/x.jpg", "//b.example/y.jpg"]',
            "imageurl": None,
        }
    )
    assert isinstance(out.get("image_urls"), list)
    assert out["image_urls"] == ["https://a.example/x.jpg", "https://b.example/y.jpg"]
    assert out["imageurl"] == "https://a.example/x.jpg"


def test_normalize_property_row_image_urls_invalid_json_string_becomes_empty_list():
    out = _normalize_property_row({"id": "3", "image_urls": "not json", "imageurl": None})
    assert isinstance(out.get("image_urls"), list)
    assert out["image_urls"] == []


def test_normalize_property_row_upgrades_outward_postcode_from_raw_payload():
    out = _normalize_property_row(
        {
            "id": "4",
            "postcode": "IG3",
            "location": "Ilford",
            "data": {"raw": {"displayAddress": "Flat 2, Example Street, IG3 8DN"}},
        }
    )

    assert out["postcode"] == "IG3 8DN"
