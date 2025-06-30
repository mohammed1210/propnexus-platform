from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Create FastAPI app
app = FastAPI()

# Allow frontend origin (Vercel) and local dev
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

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# Endpoint to get properties
# -----------------------------
@app.get("/properties")
async def get_properties():
    response = supabase.table("properties").select("*").execute()
    return response.data

# -----------------------------
# Scraper imports
# -----------------------------
from backend.scraper.zoopla_scraper import scrape_zoopla_properties
from backend.scraper.rightmove_scraper import scrape_rightmove_properties

# -----------------------------
# Endpoint to scrape Zoopla
# -----------------------------
@app.post("/scrape-zoopla")
async def scrape_zoopla():
    scraped_properties = await scrape_zoopla_properties()
    return {
        "status": f"Zoopla scrape completed and {len(scraped_properties)} properties fetched",
        "data": scraped_properties
    }

# -----------------------------
# Endpoint to scrape Rightmove
# -----------------------------
@app.post("/scrape-rightmove")
async def scrape_rightmove():
    scraped_properties = await scrape_rightmove_properties()
    return {
        "status": f"Rightmove scrape completed and {len(scraped_properties)} properties fetched",
        "data": scraped_properties
    }

# -----------------------------
# Root endpoint
# -----------------------------
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}
