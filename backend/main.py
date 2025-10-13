import os, pathlib, sys, logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.15,
)
from __future__ import annotations


logging.basicConfig(level=logging.INFO)
logging.info("CWD=%s", os.getcwd())
logging.info("PYTHONPATH=%s", os.environ.get("PYTHONPATH"))
logging.info("Exists backend/main.py? %s", pathlib.Path(__file__).resolve().is_file())
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from supabase import Client, create_client

# Load env early
load_dotenv()

# --- Routers ---
# Import routers using package-relative paths (module is backend.main)
from backend.routes import area_routes, comps_routes, gpt_routes, scrape_routes  # type: ignore
from backend.routes.ai import router as ai_router  # type: ignore
from backend.routes.notes import router as notes_router  # type: ignore
from backend.routes.off_market_routes import router as off_market_router  # type: ignore
from backend.routes.save_deal import router as save_deal_router  # type: ignore
from backend.routes.stripe_routes import router as stripe_router  # type: ignore

# --- Supabase client ---
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="PropNexus Backend", version="0.3.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://propnexus-platform.vercel.app",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---
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
app.include_router(gpt_routes.router)
app.include_router(ai_router)
app.include_router(area_routes.router)
app.include_router(comps_routes.router)
app.include_router(scrape_routes.router)
app.include_router(off_market_router)
app.include_router(stripe_router)


# --- Supabase-backed property endpoints ---
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
