from backend.search.query import query as run_query


def test_query_filters_beds_and_price_and_yield() -> None:
    listings = [
        {
            "id": "m1",
            "title": "3 bed house",
            "location": "London",
            "bedrooms": 3,
            "price": 295000,
            "yield": 0.06,
        },
        {
            "id": "m2",
            "title": "2 bed flat",
            "location": "London",
            "bedrooms": 2,
            "price": 310000,
            "yield": 0.08,
        },
        {
            "id": "m3",
            "title": "4 bed detached",
            "location": "Leeds",
            "bedrooms": 4,
            "price": 280000,
            "yield": 0.04,
        },
    ]

    payload = {
        "q": "london",
        "filters": {
            "beds": {"gte": 3, "lte": 3},
            "price": {"lte": 300000},
            "yield": {"gte": 0.05},
        },
    }

    results = run_query(payload, listings)
    ids = [str(r.get("id")) for r in results]
    assert ids == ["m1"]
