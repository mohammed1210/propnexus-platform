from backend.utils.listing_keys import strip_empty_for_upsert


def test_strip_empty_for_upsert_drops_zero_lat_lng():
    row = {
        "source": "zoopla",
        "external_id": "123",
        "url": "https://example.com/1",
        "latitude": 0.0,
        "longitude": 0,
        "title": "X",
    }

    out = strip_empty_for_upsert(row)

    assert "latitude" not in out
    assert "longitude" not in out


def test_strip_empty_for_upsert_keeps_nonzero_lat_lng():
    row = {
        "source": "zoopla",
        "external_id": "123",
        "url": "https://example.com/1",
        "latitude": 51.5,
        "longitude": -0.12,
        "title": "X",
    }

    out = strip_empty_for_upsert(row)

    assert out["latitude"] == 51.5
    assert out["longitude"] == -0.12
