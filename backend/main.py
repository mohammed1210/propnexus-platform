from fastapi import FastAPI
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    await scrape_zoopla_properties()
    return {"status": "Zoopla scrape completed and property inserted"}

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    await scrape_rightmove_properties()
    return {"status": "Rightmove scrape completed and property inserted"}
