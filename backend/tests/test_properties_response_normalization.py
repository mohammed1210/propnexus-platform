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
