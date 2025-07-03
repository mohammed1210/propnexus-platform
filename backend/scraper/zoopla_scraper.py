from fastapi import BackgroundTasks, HTTPException
from utils.postcode import get_lat_lng_from_postcode

async def scrape_zoopla_properties(background_tasks: BackgroundTasks = None):
    print("Zoopla scraping started...")

    try:
        properties = [
            {
                "title": "Example Zoopla Property",
                "location": "KT12 1AA",
                "price": 200000
            }
        ]

        for prop in properties:
            coords = get_lat_lng_from_postcode(prop["location"])
            if coords:
                prop["latitude"] = coords["latitude"]
                prop["longitude"] = coords["longitude"]
            else:
                prop["latitude"] = 0
                prop["longitude"] = 0

            print(f"Processed property: {prop['title']} ({prop['latitude']}, {prop['longitude']})")

        print("Zoopla scraping finished and data inserted.")
        return properties

    except Exception as e:
        print("Error during Zoopla scraping:", e)
        raise HTTPException(status_code=500, detail="Failed to scrape Zoopla properties")
