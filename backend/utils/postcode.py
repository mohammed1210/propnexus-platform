import requests

async def get_lat_lng_from_postcode(postcode: str):
    try:
        res = requests.get(f"https://api.postcodes.io/postcodes/{postcode}")
        data = res.json()

        if res.status_code == 200 and data["status"] == 200:
            return {
                "latitude": data["result"]["latitude"],
                "longitude": data["result"]["longitude"]
            }
        else:
            return None
    except Exception as e:
        print(f"Failed to fetch lat/lng for postcode {postcode}: {e}")
        return None
