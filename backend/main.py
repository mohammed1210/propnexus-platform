from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Get Supabase keys
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize FastAPI app
app = FastAPI()

# Allow CORS (frontend)
origins = [
    "https://propnexus-platform.vercel.app",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/properties")
async def get_properties():
    response = supabase.table("properties").select("*").execute()
    return response.data

@app.post("/scrape-zoopla")
async def scrape_zoopla():
    # Example new property data (replace this with actual scraper logic)
    new_property = {
        "title": "Zoopla Example Property",
        "location": "London SE1",
        "price": 450000,
        "imageurl": "https://example.com/image-zoopla.jpg",
        "description": "Example property from Zoopla scrape",
        "source": "Zoopla",
        "yield_percent": 6.5,
        "roi_percent": 9.2,
        "bmv": 12.0,
    }
    supabase.table("properties").insert(new_property).execute()
    return {"status": "Zoopla scrape completed and property inserted"}

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    new_property = {
        "title": "Rightmove Example Property",
        "location": "Manchester M1",
        "price": 350000,
        "imageurl": "https://example.com/image-rightmove.jpg",
        "description": "Example property from Rightmove scrape",
        "source": "Rightmove",
        "yield_percent": 7.0,
        "roi_percent": 10.5,
        "bmv": 15.0,
    }
    supabase.table("properties").insert(new_property).execute()
    return {"status": "Rightmove scrape completed and property inserted"}
