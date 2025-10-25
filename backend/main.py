from __future__ import annotations

# Load env BEFORE importing modules that read env
import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# 3rd party
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Local deps
try:
    from .db import sb  # shared Supabase client (may be None)
except ImportError:
    from db import sb

from .routes.ai import router as ai_router
from .routes.area_intel_routes import router as area_intel_router
from .routes.comps_routes import router as comps_router
from .routes.gpt_routes import router as gpt_router
from .routes.health import router as health_router
from .routes.import_routes import router as import_router
from .routes.notes import router as notes_router
from .routes.off_market_routes import router as off_market_router
from .routes.save_deal import router as save_deal_router
from .routes.scrape_routes import router as scrape_router
from .routes.stripe_routes import router as stripe_router

app = FastAPI(title="PropNexus Backend", version="0.1.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://propnexus-platform.vercel.app",
    ],
    allow_origin_regex=r"^(https://.*\.vercel\.app|https://.*\.app\.github\.dev)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"ok": True}


# --- Routers ---
app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_router)
app.include_router(ai_router)
app.include_router(area_intel_router)
app.include_router(comps_router)
app.include_router(scrape_router)
app.include_router(off_market_router)
app.include_router(stripe_router)
app.include_router(import_router)
app.include_router(health_router)


# --- Supabase-backed endpoints ---
@app.get("/properties")
async def get_properties():
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return sb.table("properties").select("*").execute().data


@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    res = sb.table("properties").select("*").eq("id", property_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Property not found")
    return res.data[0]
