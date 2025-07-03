from fastapi import BackgroundTasks
from utils.postcode import get_lat_lng_from_postcode

async def scrape_zoopla_properties(background_tasks: BackgroundTasks = None):
    print("Zoopla scraping started...")

    # Example dummy property for demonstration
    property = {
        "title": "Example Zoopla Property",
        "price": 200000,
        "location": "KT12 1AA"  # Postcode
    }

    coords = await get_lat_lng_from_postcode(property["location"])

    if coords:
        property["latitude"] = coords["latitude"]
        property["longitude"] = coords["longitude"]
    else:
        property["latitude"] = 0
        property["longitude"] = 0

    # 🚨 TODO: Here you'd normally insert into your DB
    print("Zoopla property with coordinates:", property)

    print("Zoopla scraping finished and data inserted.")
    return [property]
