from __future__ import annotations
import time
from typing import Dict, Any

# NOTE: Stub provider layer. Replace with real integrations later.
# Keep outputs stable/deterministic for caching tests.

def get_comps_from_provider(postcode: str) -> Dict[str, Any]:
    seed = postcode.strip().upper().replace(" ", "")
    # simple deterministic numbers from seed
    base = sum(ord(c) for c in seed) % 100_000
    return {
        "postcode": postcode,
        "fetched_at": int(time.time()),
        "sales": [
            {"address": f"{i} High St, {postcode}", "price": base + i * 1000, "date": "2024-08-0{}".format(i+1), "type": "Terraced"}
            for i in range(1, 6)
        ],
        "rents": [
            {"address": f"{i} Market Rd, {postcode}", "price": (base//10) + i * 100, "date": "2024-07-0{}".format(i+1), "type": "Flat"}
            for i in range(1, 6)
        ],
    }

def get_area_intel_from_provider(key: str) -> Dict[str, Any]:
    seed = key.strip().lower().replace(" ", "-")
    base = sum(ord(c) for c in seed) % 100
    return {
        "key": key,
        "summary": f"Mock area intel for {key}. Walkability {50+base%50}/100.",
        "stats": {
            "crime_index": 40 + (base % 30),
            "schools_score": 60 + (base % 30),
            "transport_score": 55 + (base % 40),
        },
        "fetched_at": int(time.time()),
    }
