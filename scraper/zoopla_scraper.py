import asyncio
from scraper.utils import insert_property_to_supabase

async def scrape_zoopla():
    # Example dummy properties to simulate scrape
    example_properties = [
        {
            "title": "Zoopla Example Property 1",
            "location": "London",
            "price": 350000,
            "yield_percent": 5.2,
            "roi_percent": 8.1,
            "bmv": 10,
            "image_url": "https://example.com/image1.jpg",
            "description": "Spacious flat in prime location.",
            "source": "Zoopla"
        },
        {
            "title": "Zoopla Example Property 2",
            "location": "Manchester",
            "price": 220000,
            "yield_percent": 6.5,
            "roi_percent": 9.2,
            "bmv": 12,
            "image_url": "https://example.com/image2.jpg",
            "description": "Ideal for investors, high rental demand.",
            "source": "Zoopla"
        }
    ]

    for prop in example_properties:
        await insert_property_to_supabase(prop)

    return {"status": "Zoopla scrape completed and properties inserted"}

# Test locally
if __name__ == "__main__":
    asyncio.run(scrape_zoopla())
