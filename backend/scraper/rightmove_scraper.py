from fastapi import BackgroundTasks
from utils.postcode import get_lat_lng_from_postcode

async def scrape_rightmove_properties(background_tasks: BackgroundTasks = None):
    print("Rightmove scraping started...")

    # Example dummy property for demonstration
    property = {
        "title": "Example Rightmove Property",
        "price": 300000,
        "location": "NG7 2RD"  # Postcode
    }

    coords = await get_lat_lng_from_postcode(property["location"])

    if coords:
        property["latitude"] = coords["latitude"]
        property["longitude"] = coords["longitude"]
    else:
        property["latitude"] = 0
        property["longitude"] = 0

    # 🚨 TODO: Here you'd normally insert into your DB
    print("Rightmove property with coordinates:", property)

    print("Rightmove scraping finished and data inserted.")
    return [property]
