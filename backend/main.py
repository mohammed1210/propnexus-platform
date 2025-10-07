from __future__ import annotations
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client, create_client

# ==========================================================
# Load environment first (before importing routers)
# ==========================================================
load_dotenv()

# ==========================================================
# Router imports (absolute imports; safe for package context)
# ==========================================================
from backend.routes import (
    area_routes,
    comps_routes,
    gpt_routes,
    scrape_routes,
)
from backend.routes.ai import router as ai_router
from backend.routes.notes import router as notes_router
from backend.routes.off_market_routes import router as off_market_router
from backend.routes.save_deal import router as save_deal_router
from backend.routes.stripe_routes import router as stripe_router

# ==========================================================
# Supabase client (prefer service role on server)
# ==========================================================
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================================
# FastAPI app setup
# ==========================================================
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# ----------------------------------------------------------
# CORS configuration
# ----------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://propnexus-platform.vercel.app",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------
# Health endpoints
# ----------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}

@app.get("/health")
async def health():
    return {"ok": True}

# ----------------------------------------------------------
# Router includes (safe ordering; Supabase loaded)
# ----------------------------------------------------------
app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_routes.router)
app.include_router(ai_router)
app.include_router(area_routes.router)
app.include_router(comps_routes.router)
app.include_router(scrape_routes.router)
app.include_router(off_market_router)
app.include_router(stripe_router)

# ----------------------------------------------------------
# Supabase-backed property endpoints
# ----------------------------------------------------------
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
