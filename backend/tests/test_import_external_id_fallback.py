from backend.routes.import_routes import _clean_row


def test_clean_row_sets_external_id_when_missing():
    now_iso = "2026-01-01T00:00:00Z"
    p = {
        "title": "Test",
        "source": "zoopla",
        "url": "https://www.zoopla.co.uk/for-sale/details/12345678/",
        "location": "London",
        "price": 350000,
        "bedrooms": 2,
    }

    row = _clean_row(p, now_iso)

    assert row.get("external_id")
    assert str(row["external_id"]).isdigit()
