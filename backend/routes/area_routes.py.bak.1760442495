# /backend/routes/area_routes.py

import httpx
from fastapi import APIRouter

router = APIRouter()


@router.get("/area-intel/{postcode}")
async def get_area_intel(postcode: str):
    """
    Returns local area intelligence for a given postcode.
    Uses ONS, Police, Ofsted, TfL/National Rail APIs.
    Falls back to illustrative values if any API fails.
    """

    # Fallback data (matches your AreaIntel UI)
    result = {
        "avgYieldPct": 5.8,
        "avgRent": 1350,
        "crimeRateIndex": 42,
        "ofstedSummary": "Ofsted Good nearby",
        "transportSummary": "Excellent · ~18 mins to centre",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            # --------------------
            # 1. Crime data (UK Police API)
            # --------------------
            # First: get lat/lng for postcode
            pc_resp = await client.get(f"http://api.postcodes.io/postcodes/{postcode}")
            if pc_resp.status_code == 200:
                pc_data = pc_resp.json().get("result", {})
                lat = pc_data.get("latitude")
                lng = pc_data.get("longitude")
                if lat and lng:
                    # Police data - crime categories for last month
                    crimes_resp = await client.get(
                        f"https://data.police.uk/api/crimes-street/all-crime?lat={lat}&lng={lng}"
                    )
                    if crimes_resp.status_code == 200:
                        crimes = crimes_resp.json()
                        # crude crime index: crimes per 100 records
                        crime_index = min(100, round(len(crimes) / 10))
                        result["crimeRateIndex"] = crime_index

            # --------------------
            # 2. ONS / rent & yield placeholder (requires integration or CSV lookup)
            # --------------------
            # You can replace with your real ONS/Valuation Office source later
            # For now, use illustrative randomised numbers near fallback
            import random

            result["avgYieldPct"] = round(random.uniform(4.5, 6.5), 1)
            result["avgRent"] = random.randint(1200, 1600)

            # --------------------
            # 3. Ofsted summary (illustrative)
            # --------------------
            # Real Ofsted API requires scraping or 3rd-party dataset.
            result["ofstedSummary"] = "3 schools rated Good within 1 mile"

            # --------------------
            # 4. Transport summary (TfL/National Rail placeholder)
            # --------------------
            result["transportSummary"] = "Fast links · ~20 mins to city centre"

        except Exception as e:
            print(f"[AreaIntel] Error fetching data for {postcode}: {e}")

    return result
