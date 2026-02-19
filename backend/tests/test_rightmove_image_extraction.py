from backend.scraper.rightmove_scraper import _rm_property_from_api_dict


def test_rightmove_property_dict_extracts_image_from_next_images():
    p = {
        "id": 166973108,
        "displayAddress": "Somewhere, Liverpool",
        "price": {"amount": 250000},
        "bedrooms": 2,
        "bathrooms": 1,
        "images": [
            {
                "srcUrl": "https://media.rightmove.co.uk/dir/crop/10:9-16:9/69k/68046/166973108/68046_TS109_IMG_00_0000_max_476x317.jpeg",
                "url": "69k/68046/166973108/68046_TS109_IMG_00_0000.jpeg",
                "caption": None,
            }
        ],
        "location": {"latitude": 53.4, "longitude": -2.9},
    }

    out = _rm_property_from_api_dict(p)
    assert out is not None
    assert out.get("source") == "rightmove"
    assert out.get("external_id") == "166973108"

    # Must prefer the absolute srcUrl and store it into canonical image fields.
    assert out.get("imageurl") == p["images"][0]["srcUrl"]
    assert out.get("image_url") == p["images"][0]["srcUrl"]
    assert out.get("image_urls") and out["image_urls"][0].startswith(
        "https://media.rightmove.co.uk/"
    )


def test_rightmove_property_dict_normalizes_protocol_relative_image_urls():
    p = {
        "id": 166973109,
        "displayAddress": "Somewhere, London",
        "price": {"amount": 350000},
        "bedrooms": 3,
        "bathrooms": 2,
        "images": [
            {
                "srcUrl": "//media.rightmove.co.uk/dir/crop/10:9-16:9/69k/68046/166973109/68046_TS109_IMG_00_0000_max_476x317.jpeg",
            }
        ],
    }

    out = _rm_property_from_api_dict(p)
    assert out is not None
    assert out.get("imageurl", "").startswith("https://media.rightmove.co.uk/")
    assert out.get("image_url", "").startswith("https://media.rightmove.co.uk/")
    assert out.get("image_urls") and out["image_urls"][0].startswith(
        "https://media.rightmove.co.uk/"
    )
