from fastapi import FastAPI
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties
from database import insert_property_to_supabase

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    # Scrape properties from Zoopla
    scraped_properties = await scrape_zoopla_properties()

    # Insert each property into Supabase
    for prop in scraped_properties:
        await insert_property_to_supabase(prop)

    return {"status": f"Zoopla scrape completed and {len(scraped_properties)} properties inserted"}

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    # Scrape properties from Rightmove
    scraped_properties = await scrape_rightmove_properties()

    # Insert each property into Supabase
    for prop in scraped_properties:
        await insert_property_to_supabase(prop)

    return {"status": f"Rightmove scrape completed and {len(scraped_properties)} properties inserted"}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "OK"}
