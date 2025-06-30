from fastapi import FastAPI
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    scraped_properties = await scrape_zoopla_properties()
    return {
        "status": f"Zoopla scrape completed and {len(scraped_properties)} properties fetched",
        "data": scraped_properties,
    }

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    scraped_properties = await scrape_rightmove_properties()
    return {
        "status": f"Rightmove scrape completed and {len(scraped_properties)} properties fetched",
        "data": scraped_properties,
    }
