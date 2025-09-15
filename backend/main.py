# backend/main.py
import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

# -----------------------------
# Load env
# -----------------------------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# -----------------------------
# CORS (explicit + vercel previews)
# -----------------------------
origins = [
    "https://propnexus-platform.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Root + health
# -----------------------------
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.get("/health")
async def health():
    return {"ok": True}

@app.get("/api/health")
async def api_health():
    return {"ok": True}

# -----------------------------
# Routers
# -----------------------------
from routes import scrape_routes, area_routes, comps_routes, gpt_routes
from routes.ai_routes import router as ai_routes
from routes.notes import router as notes_router
from routes.off_market_routes import router as off_market_router
from routes.save_deal import router as save_deal_router
from routes.stripe_routes import router as stripe_router

app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_routes.router)
app.include_router(ai_routes)
app.include_router(area_routes.router)
app.include_router(comps_routes.router)
app.include_router(scrape_routes.router)
app.include_router(off_market_router)
app.include_router(stripe_router)

# -----------------------------
# Supabase property endpoints
# -----------------------------
@app.get("/properties")
async def get_properties():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return supabase.table("properties").select("*").execute().data

@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    res = supabase.table("properties").select("*").eq("id", property_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Property not found")
    return res.data[0]

@app.get("/api/properties/{property_id}")
async def get_property_by_id_alias(property_id: str):
    return await get_property_by_id(property_id)