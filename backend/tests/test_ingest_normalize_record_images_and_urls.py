from backend.utils.ingest import normalize_record


def test_normalize_record_preserves_image_urls_and_maps_raw_url_to_url_fields():
    raw = {
        "title": "Example",
        "description": "Nice place",
        "raw_url": "https://www.rightmove.co.uk/properties/123456789",
        "image_urls": [
            "//media.rightmove.co.uk/1k/2/123456789/2_1_IMG_00.jpeg",
            "https://media.rightmove.co.uk/1k/2/123456789/2_1_IMG_01.jpeg",
            "",
            None,
        ],
    }

    out = normalize_record(raw, source="rightmove")

    assert out.get("listing_url") == "https://www.rightmove.co.uk/properties/123456789"
    assert out.get("url") == "https://www.rightmove.co.uk/properties/123456789"

    assert out.get("image_urls") == [
        "https://media.rightmove.co.uk/1k/2/123456789/2_1_IMG_00.jpeg",
        "https://media.rightmove.co.uk/1k/2/123456789/2_1_IMG_01.jpeg",
    ]

    # If no explicit imageurl is provided, it should promote the first gallery image.
    assert out.get("imageurl") == "https://media.rightmove.co.uk/1k/2/123456789/2_1_IMG_00.jpeg"
