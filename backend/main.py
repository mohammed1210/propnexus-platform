from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Route modules
try:
    from backend.routes.health import router as health_router  # type: ignore
except Exception:  # pragma: no cover
    health_router = None  # type: ignore

try:
    from backend.routes.area_intel_routes import (
        router as area_intel_router,  # type: ignore
    )
except Exception:  # pragma: no cover
    area_intel_router = None  # type: ignore

try:
    from backend.routes.comps_routes import router as comps_router  # type: ignore
except Exception:  # pragma: no cover
    comps_router = None  # type: ignore

try:
    from backend.routes.gpt_routes import router as gpt_router  # type: ignore
except Exception:  # pragma: no cover
    gpt_router = None  # type: ignore

try:
    from backend.routes.scrape_routes import router as scrape_router  # type: ignore
except Exception:  # pragma: no cover
    scrape_router = None  # type: ignore

# Load env early (after imports to satisfy E402)
load_dotenv()


# Routers (relative imports; keep at top for linter)
from .routes import area_routes, comps_routes, gpt_routes, scrape_routes  # noqa: E402
from .routes.ai import router as ai_router  # noqa: E402
from .routes.notes import router as notes_router  # noqa: E402
from .routes.off_market_routes import router as off_market_router  # noqa: E402
from .routes.save_deal import router as save_deal_router  # noqa: E402
from .routes.stripe_routes import router as stripe_router  # noqa: E402

# Supabase client (prefer service role on server)SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# CORS
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
app.include_router(ai_router)  # <- PO2 additive include
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


# --- Include cache routes ---
try:
    app.include_router(comps_router)
    app.include_router(area_intel_router)
except Exception:
    # app may be defined later in some imports; if so, routers are imported in the file already.
    pass


# register health router
try:
    app.include_router(health_router.router)
except Exception as e:
    print("health router registration failed:", e)
