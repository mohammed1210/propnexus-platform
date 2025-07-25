from supabase import create_client, Client
import os

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
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
        "source": property_data["source"]
    }
    supabase.table("properties").insert(data).execute()
