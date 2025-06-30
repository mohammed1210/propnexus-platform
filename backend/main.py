from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

app = FastAPI()

# Allow frontend origin and local dev
origins = [
    "https://propnexus-platform.vercel.app",
    "http://localhost:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    data = await scrape_zoopla_properties()
    return {"status": f"Zoopla scrape completed and {len(data)} properties fetched", "data": data}

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    data = await scrape_rightmove_properties()
    return {"status": f"Rightmove scrape completed and {len(data)} properties fetched", "data": data}
