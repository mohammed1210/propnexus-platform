from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
import os

# ✅ Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ✅ Create FastAPI app
app = FastAPI()

# ✅ CORS setup
origins = [
    "https://propnexus-platform.vercel.app",
    "https://propnexus-platform-git-2872bb-mohammed-abbas-projects-8ab7e126.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Route imports
from routes import gpt_routes
from routes.ai_routes import router as ai_routes  # NEW
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

# ✅ Include routes
app.include_router(gpt_routes.router)
app.include_router(ai_routes)  # ✅ Register new AI route module

# ✅ Health check
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

# ✅ Get all properties
@app.get("/properties")
async def get_properties():
    response = supabase.table("properties").select("*").execute()
    return response.data

# ✅ Get property by ID
@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    try:
        response = supabase.table("properties").select("*").eq("id", property_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Alias route (Next.js fetch expects /api/)
@app.get("/api/properties/{property_id}")
async def get_property_by_id_alias(property_id: str):
    try:
        response = supabase.table("properties").select("*").eq("id", property_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ✅ Scrape Zoopla
@app.post("/scrape-zoopla")
async def scrape_zoopla():
    data = await scrape_zoopla_properties()
    return {
        "status": f"Zoopla scrape completed and {len(data)} properties fetched",
        "data": data,
    }

# ✅ Scrape Rightmove
@app.post("/scrape-rightmove")
async def scrape_rightmove():
    data = await scrape_rightmove_properties()
    return {
        "status": f"Rightmove scrape completed and {len(data)} properties fetched",
        "data": data,
    }