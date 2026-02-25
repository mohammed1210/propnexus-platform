from datetime import datetime, timedelta

# NOTE: Stub providers for now; replace with real integrations later.
# Keep outputs deterministic & structured for predictable caching/tests.


def get_comps_from_provider(postcode: str) -> dict:
    base = postcode.strip().upper() or "N/A"
    return {
        "postcode": base,
        "sales": [
            {
                "address": f"10 {base} Street",
                "price": 250000,
                "date": (datetime.utcnow() - timedelta(days=30)).date().isoformat(),
                "type": "Terraced",
                "distance_km": 0.42,
            },
            {
                "address": f"22 {base} Road",
                "price": 310000,
                "date": (datetime.utcnow() - timedelta(days=65)).date().isoformat(),
                "type": "Semi-detached",
                "distance_km": 0.87,
            },
        ],
        "rents": [
            {
                "address": f"Flat 2, 5 {base} Close",
                "price": 1200,
                "date": (datetime.utcnow() - timedelta(days=15)).date().isoformat(),
                "type": "Flat",
                "distance_km": 0.35,
            },
            {
                "address": f"Flat 4, 3 {base} Court",
                "price": 1450,
                "date": (datetime.utcnow() - timedelta(days=40)).date().isoformat(),
                "type": "Flat",
                "distance_km": 1.12,
            },
        ],
    }


def get_area_intel_from_provider(key: str) -> dict:
    k = key.strip().upper() or "UNKNOWN"
    # Provide a stable shape: demographics, transport, schools, yields etc.
    return {
        "key": k,
        "population": 125_000,
        "avg_price": 305_000,
        "avg_rent": 1350,
        "rental_yield_percent": round((1350 * 12) / 305_000 * 100, 2),
        "crime_index": 42,  # mock score 0..100 (lower is better)
        "schools_rating": 3.9,  # mock 0..5
        "transport_links": ["Rail", "Bus"],
        "notes": f"Mock intel for {k}. Replace with live sources.",
    }
