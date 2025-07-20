from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# ✅ Load .env variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# ✅ CORS setup — allow both production & local
origins = [
    "https://propnexus-platform.vercel.app",
    "https://propnexus-platform-git-2872bb-mohammed-abbas-projects-8ab7e126.vercel.app",  # Your feature branch URL
    "http://localhost:3000",
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

@app.get("/properties")
async def get_properties():
    """
    ✅ Fetch properties from Supabase table
    """
    response = supabase.table("properties").select("*").execute()
    return response.data

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    """
    ✅ Trigger Zoopla scraper
    """
    data = await scrape_zoopla_properties()
    return {
        "status": f"Zoopla scrape completed and {len(data)} properties fetched",
        "data": data,
    }

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    """
    ✅ Trigger Rightmove scraper
    """
    data = await scrape_rightmove_properties()
    return {
        "status": f"Rightmove scrape completed and {len(data)} properties fetched",
        "data": data,
    }

@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    response = supabase.table("properties").select("*").eq("id", property_id).execute()

    if not response.data or len(response.data) == 0:
        return {"detail": "Not Found"}

    return response.data[0]
