import os

from supabase import Client, create_client

supabase_url = os.getenv("SUPABASE_URL")
# Use the service role key for server-side writes from scrapers
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)


async def insert_property_to_supabase(property_data):
    data = {
        "title": property_data["title"],
        "location": property_data["location"],
        "price": property_data["price"],
        "yield_percent": property_data["yield_percent"],
        "roi_percent": property_data["roi_percent"],
        "bmv": property_data["bmv"],
        "imageurl": property_data["image_url"],
        "description": property_data["description"],
        "source": property_data["source"],
    }
    supabase.table("properties").insert(data).execute()
