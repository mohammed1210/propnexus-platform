from backend.routes.import_routes import _clean_row


def test_clean_row_hydrates_from_data_raw_and_normalizes_urls():
    now_iso = "2026-01-01T00:00:00Z"
    raw = {
        "location": "London",
        "price": "£350,000",
        "bedrooms": 2,
        "bathrooms": 1,
        "latitude": 51.5,
        "longitude": -0.12,
        "image_url": "//images.example.com/a.jpg",
        "image_urls": ["//images.example.com/a.jpg", "https://images.example.com/b.jpg"],
    }

    p = {
        "title": "Test",
        "source": "zoopla",
        "external_id": "123",
        "data": {"raw": raw},
        # Intentionally missing top-level fields that the UI uses.
        "location": None,
        "address": None,
        "price": None,
        "bedrooms": 0,
        "bathrooms": 0,
        "latitude": 0.0,
        "longitude": 0.0,
        "imageurl": None,
        "image_urls": ["//images.example.com/c.jpg"],
    }

    row = _clean_row(p, now_iso)

    assert row["location"] == "London"
    assert row["address"] == "London"
    assert row["price"] == 350000
    assert row["bedrooms"] == 2
    assert row["bathrooms"] == 1
    assert row["latitude"] == 51.5
    assert row["longitude"] == -0.12

    assert row["imageurl"] == "https://images.example.com/a.jpg"
    assert row["image_urls"][0] == "https://images.example.com/c.jpg"


def test_clean_row_maps_image_url_field_name_to_imageurl():
    now_iso = "2026-01-01T00:00:00Z"
    p = {
        "title": "Test",
        "source": "rightmove",
        "external_id": "123",
        "image_url": "//cdn.example.com/x.jpg",
    }

    row = _clean_row(p, now_iso)

    assert "image_url" not in row
    assert row["imageurl"] == "https://cdn.example.com/x.jpg"
