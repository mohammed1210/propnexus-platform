import requests
from bs4 import BeautifulSoup
from ..utils.postcode import get_lat_lng_from_postcode


async def scrape_rightmove_properties():
    print("🔍 Scraping Rightmove...")

    search_url = "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E94346&minBedrooms=2&maxPrice=200000&propertyTypes=flat&includeSSTC=false"

    headers = {
        "User-Agent": "Mozilla/5.0",
    }

    res = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(res.text, "html.parser")
    cards = soup.select(".propertyCard")

    results = []

    for card in cards[:5]:  # Limit to 5 for now
        try:
            title = card.select_one(".propertyCard-title").get_text(strip=True)
            price_text = card.select_one(".propertyCard-priceValue").get_text(
                strip=True
            )
            location = card.select_one(".propertyCard-address").get_text(strip=True)
            price = int(price_text.replace("£", "").replace(",", "").strip())

            coords = await get_lat_lng_from_postcode(location)
            lat = coords.get("latitude", 0)
            lng = coords.get("longitude", 0)

            results.append(
                {
                    "title": title,
                    "price": price,
                    "location": location,
                    "latitude": lat,
                    "longitude": lng,
                }
            )
        except Exception as e:
            print("❌ Error parsing property:", e)

    print(f"✅ Scraped {len(results)} Rightmove properties")
    return results
