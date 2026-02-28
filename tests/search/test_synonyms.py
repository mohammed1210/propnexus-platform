from backend.search.query import query as run_query


def test_flat_query_matches_apartment_listing() -> None:
    listings = [
        {
            "id": "a1",
            "title": "Bright apartment in London",
            "location": "London",
            "tags": ["apartment"],
        },
        {
            "id": "b1",
            "title": "Detached house in Leeds",
            "location": "Leeds",
            "tags": ["house"],
        },
    ]

    results = run_query("flat in London", listings)
    ids = {r.get("id") for r in results}
    assert "a1" in ids


def test_typo_gaerage_matches_garage_listing() -> None:
    listings = [
        {
            "id": "g1",
            "title": "Family home with garage and driveway",
            "location": "Birmingham",
            "tags": ["garage", "parking"],
        },
        {
            "id": "x1",
            "title": "Studio with no parking",
            "location": "Manchester",
            "tags": ["studio"],
        },
    ]

    results = run_query("gaerage", listings)
    ids = {r.get("id") for r in results}
    assert "g1" in ids
