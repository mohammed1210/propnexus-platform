import asyncio
from scraper.utils import insert_property_to_supabase

async def scrape_rightmove():
    # Example dummy properties to simulate scrape
    example_properties = [
        {
            "title": "Rightmove Example Property 1",
            "location": "Birmingham",
            "price": 280000,
            "yield_percent": 5.8,
            "roi_percent": 7.5,
            "bmv": 11,
            "image_url": "https://example.com/image3.jpg",
            "description": "Recently refurbished family home.",
            "source": "Rightmove"
        },
        {
            "title": "Rightmove Example Property 2",
            "location": "Leeds",
            "price": 200000,
            "yield_percent": 7.0,
            "roi_percent": 9.0,
            "bmv": 9,
            "image_url": "https://example.com/image4.jpg",
            "description": "Close to universities, great rental potential.",
            "source": "Rightmove"
        }
    ]

    for prop in example_properties:
        await insert_property_to_supabase(prop)

    return {"status": "Rightmove scrape completed and properties inserted"}

# Test locally
if __name__ == "__main__":
    asyncio.run(scrape_rightmove())
