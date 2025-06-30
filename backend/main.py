from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.scraper.zoopla_scraper import scrape_zoopla_properties
from backend.scraper.rightmove_scraper import scrape_rightmove_properties

app = FastAPI()

# ✅ Allow CORS for your frontend domain
origins = [
    "https://propnexus-platform.vercel.app",
    "http://localhost:3000",  # optional: for local dev
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

# Example dummy properties endpoint if needed
@app.get("/properties")
async def get_properties():
    return [
        {"title": "Example Zoopla Property", "price": "£200,000", "yield_percent": 6.5},
        {"title": "Example Rightmove Property", "price": "£300,000", "yield_percent": 5.2},
    ]
