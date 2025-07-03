from fastapi import BackgroundTasks
from utils.postcode import get_lat_lng_from_postcode

async def scrape_rightmove_properties(background_tasks: BackgroundTasks = None):
    print("Rightmove scraping started...")

    # Example dummy property list
    properties = [
        {
            "title": "Example Rightmove Property",
            "location": "NG7 2RD",
            "price": 300000
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

        # Example log; here you'd insert to DB
        print(f"Processed property: {prop['title']} ({prop['latitude']}, {prop['longitude']})")

    print("Rightmove scraping finished and data inserted.")

    # Return properties to confirm
    return properties
