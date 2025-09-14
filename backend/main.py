# backend/main.py

"""
Entry point for the PropNexus FastAPI backend.

This module initialises the FastAPI application, configures CORS,
loads environment variables, sets up the Supabase client and
registers all route modules. Additional routers for metrics and
email notifications are included as part of the Sprint‑4
operationalisation efforts.

The `/` root endpoint returns a simple message. Core property
endpoints (`/properties` and `/properties/{id}`) expose the
Supabase‐backed data store. See individual route modules under
`backend/routes/` for more functionality.
"""

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
from routes import scrape_routes
from routes import stripe_routes  # billing/paywall
from routes import digests_routes  # digest emails

# New operational routes
from routes.metrics_routes import router as metrics_router
from routes.email_routes import router as email_router

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

# CORS configuration: allow Vercel previews/prod and localhost during dev
origins = [
    "https://propnexus-platform.vercel.app",
    "https://propnexus-platform-git-2872bb-mohammed-abbas-projects-8ab7e126.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*vercel\.app$",  # any Vercel preview/prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# Register routers
# ===============================
app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_routes.router)
app.include_router(ai_routes)
app.include_router(area_routes.router)
app.include_router(comps_routes.router)
app.include_router(scrape_routes.router)  # unified scrape

# Include new operational routers
app.include_router(metrics_router)
app.include_router(email_router)

# ===============================
# Root endpoint
# ===============================
@app.get("/")
async def root() -> dict[str, str]:
    """Simple root endpoint to confirm the API is running."""
    return {"message": "PropNexus backend is running."}


# ===============================
# Properties (Supabase)
# ===============================
@app.get("/properties")
async def get_properties():
    """Fetch all properties from Supabase."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    response = supabase.table("properties").select("*").execute()
    return response.data


@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    """Fetch a single property by its ID."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    try:
        response = (
            supabase.table("properties")
            .select("*")
            .eq("id", property_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Alias for Next.js fetches (/api/…)
@app.get("/api/properties/{property_id}")
async def get_property_by_id_alias(property_id: str):
    """Alias route for compatibility with Next.js API calls."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase env vars not configured")
    try:
        response = (
            supabase.table("properties")
            .select("*")
            .eq("id", property_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))