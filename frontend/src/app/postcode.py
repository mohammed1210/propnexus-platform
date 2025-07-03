import requests

def get_lat_lng_from_postcode(postcode: str):
    try:
        url = f"https://api.postcodes.io/postcodes/{postcode}"
        res = requests.get(url)
        data = res.json()
        if res.status_code == 200 and data["status"] == 200:
            return {
                "latitude": data["result"]["latitude"],
                "longitude": data["result"]["longitude"]
            }
        else:
            return None
    except Exception as e:
        print("Failed to fetch lat/lng:", e)
        return None
