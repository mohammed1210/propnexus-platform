from backend.utils.listing_keys import ensure_external_id, strip_empty_for_upsert


def test_ensure_external_id_hash_is_stable_for_same_inputs():
    row = {
        "source": "zoopla",
        "address": "10 Downing St, London SW1A 2AA",
        "price": 350000,
        "bedrooms": 2,
    }

    a = ensure_external_id(row)
    b = ensure_external_id(row)

    assert isinstance(a, str)
    assert a == b
    assert len(a) == 16


def test_strip_empty_for_upsert_drops_empty_fields():
    row = {
        "source": "zoopla",
        "external_id": "123",
        "last_seen_at": "2026-01-01T00:00:00Z",
        "image_urls": [],
        "imageurl": None,
        "price": 0,
        "latitude": 0.0,
        "title": "",
        "location": "London",
    }

    out = strip_empty_for_upsert(row)

    assert out["source"] == "zoopla"
    assert out["external_id"] == "123"
    assert out["last_seen_at"] == "2026-01-01T00:00:00Z"

    # Empty/placeholder fields removed.
    assert "image_urls" not in out
    assert "imageurl" not in out
    assert "price" not in out
    assert "latitude" not in out
    assert "title" not in out

    # Non-empty kept.
    assert out["location"] == "London"
