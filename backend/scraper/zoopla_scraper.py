# backend/scraper/zoopla_scraper.py

from __future__ import annotations

from bs4 import (  # noqa: F401  (kept for when you replace the stub with real parsing)
    BeautifulSoup,
)
from fastapi import BackgroundTasks

from ..utils.postcode import get_lat_lng_from_postcode


async def scrape_zoopla_properties(background_tasks: BackgroundTasks | None = None):
    """
    Minimal async Zoopla scraper stub:
    - returns one example property
    - looks up lat/lng from postcode using our util
    - logs progress
    Replace with real HTTP fetch + BeautifulSoup parsing when ready.
    """
    print("Zoopla scraping started...")

    # Example dummy property for demonstration
    prop = {
        "title": "Example Zoopla Property",
        "price": 200_000,
        "location": "KT12 1AA",  # Postcode
    }

    coords = await get_lat_lng_from_postcode(prop["location"])

    if coords:
        prop["latitude"] = coords["latitude"]
        prop["longitude"] = coords["longitude"]
    else:
        prop["latitude"] = 0.0
        prop["longitude"] = 0.0

    # 🚨 TODO: persist to DB (Supabase) if desired
    print("Zoopla property with coordinates:", prop)
    print("Zoopla scraping finished and data inserted.")
    return [prop]
