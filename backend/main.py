# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
import os

# Route modules
from routes.save_deal import router as save_deal_router
from routes.notes import router as notes_router
from routes import gpt_routes
from routes.ai_routes import router as ai_routes
from routes import area_routes
from routes import comps_routes
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

# ===============================
# Env & Supabase client
# ===============================
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ===============================
# FastAPI app
# ===============================
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# CORS
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

# Register routers
app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_routes.router)
app.include_router(ai_routes)
app.include_router(area_routes.router)
app.include_router(comps_routes.router)

# ===============================
# Health
# ===============================
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

# ===============================
# Properties (Supabase)
# ===============================
@app.get("/properties")
async def get_properties():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    response = supabase.table("properties").select("*").execute()
    return response.data

@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    try:
        response = supabase.table("properties").select("*").eq("id", property_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Alias for Next.js fetches (/api/…)
@app.get("/api/properties/{property_id}")
async def get_property_by_id_alias(property_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    try:
        response = supabase.table("properties").select("*").eq("id", property_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===============================
# Scraper endpoints
# ===============================
@app.post("/scrape-zoopla")
async def scrape_zoopla():
    data = await scrape_zoopla_properties()
    return {
        "status": f"Zoopla scrape completed and {len(data)} properties fetched",
        "data": data,
    }

@app.post("/scrape-rightmove")
async def scrape_rightmove():
    data = await scrape_rightmove_properties()
    return {
        "status": f"Rightmove scrape completed and {len(data)} properties fetched",
        "data": data,
    }
