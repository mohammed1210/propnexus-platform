from fastapi import FastAPI
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties
from supabase import create_client, Client
import os

app = FastAPI()

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    scraped_properties = await scrape_zoopla_properties()
    # Example: Insert into Supabase if needed
    return {"status": f"Zoopla scrape completed and {len(scraped_properties)} properties fetched", "data": scraped_properties}

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    scraped_properties = await scrape_rightmove_properties()
    # Example: Insert into Supabase if needed
    return {"status": f"Rightmove scrape completed and {len(scraped_properties)} properties fetched", "data": scraped_properties}

@app.get("/properties")
async def get_properties():
    response = supabase.table("properties").select("*").execute()
    return response.data
