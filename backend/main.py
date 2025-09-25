from __future__ import annotations

import logging
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from supabase import Client, create_client

# ------------------------------------------------------------------------------
# Logging config (respect LOG_LEVEL if set)
# ------------------------------------------------------------------------------
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
log = logging.getLogger("uvicorn.error")

# Load env early (Railway + local)
load_dotenv()

# --- Dual-import: flat (/backend as CWD) OR package (backend.*) --------------
try:
    # Railway / local when running:  cd backend && uvicorn main:app
    from routes import (  # type: ignore
        area_routes,
        comps_routes,
        gpt_routes,
        scrape_routes,
    )
    from routes.ai import router as ai_router  # type: ignore
    from routes.notes import router as notes_router  # type: ignore
    from routes.off_market_routes import router as off_market_router  # type: ignore
    from routes.properties import router as properties_router  # type: ignore
    from routes.save_deal import router as save_deal_router  # type: ignore
    from routes.stripe_routes import router as stripe_router  # type: ignore
except ModuleNotFoundError:
    # Codespaces/local when running:  uvicorn backend.main:app
    from backend.routes import (  # type: ignore
        area_routes,
        comps_routes,
        gpt_routes,
        scrape_routes,
    )
    from backend.routes.ai import router as ai_router  # type: ignore
    from backend.routes.notes import router as notes_router  # type: ignore
    from backend.routes.off_market_routes import (
        router as off_market_router,  # type: ignore
    )
    from backend.routes.properties import router as properties_router  # type: ignore
    from backend.routes.save_deal import router as save_deal_router  # type: ignore
    from backend.routes.stripe_routes import router as stripe_router  # type: ignore

# ------------------------------------------------------------------------------
# Supabase client (prefer service role on server)
# ------------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        log.info("Supabase client created")
    except Exception:
        log.exception("Failed to create Supabase client")
else:
    log.warning(
        "Supabase env missing: url_present=%s, service_key_present=%s",
        bool(SUPABASE_URL),
        bool(SUPABASE_KEY),
    )


def _sb() -> Client:
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return supabase


# ------------------------------------------------------------------------------
# App + middleware
# ------------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")


# Robust request logging; short-circuit /health to prove traffic reaches app
@app.middleware("http")
async def _tiny_health_bypass(request, call_next):
    # Short-circuit /health no matter what, so we always get 200 if the app is alive
    if request.url.path in ("/health", "/api/health"):
        return JSONResponse({"ok": True})
    return await call_next(request)
    t0 = time.time()
    path = request.url.path

    # ❶ Fail-safe health check: bypass everything and return OK immediately.
    if path == "/health" or path == "/api/health":
        return JSONResponse(status_code=200, content={"ok": True, "via": "middleware"})

    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        # Full traceback to Deploy Logs
        log.exception("Unhandled error for %s %s", request.method, path)
        # Return a safe JSON instead of opaque 502
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": "Internal Server Error",
                "detail": str(exc.__class__.__name__),
            },
        )
    finally:
        dt = (time.time() - t0) * 1000
        logging.getLogger("uvicorn.access").info(
            "%s %s -> %.1fms", request.method, path, dt
        )


# CORS (explicit + regex for previews)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://propnexus-platform.vercel.app",
        "https://propnexus-platform-git-po2-mohammed1210.vercel.app",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------------------
# Basic root
# ------------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "PropNexus backend is running."}


# ------------------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------------------
app.include_router(save_deal_router)
app.include_router(notes_router)
app.include_router(gpt_routes.router)
app.include_router(ai_router)  # ← PO2 AI routes
app.include_router(area_routes.router)
app.include_router(comps_routes.router)
app.include_router(scrape_routes.router)
app.include_router(off_market_router)
app.include_router(properties_router)
app.include_router(stripe_router)


# ------------------------------------------------------------------------------
# Supabase-backed property endpoints (with error handling)
# ------------------------------------------------------------------------------
@app.get("/properties")
async def get_properties():
    sb = _sb()
    try:
        res = sb.table("properties").select("*").execute()
    except Exception as e:
        log.exception("Supabase exception on /properties")
        raise HTTPException(status_code=502, detail="Database upstream error") from e
    if getattr(res, "error", None):
        log.error("Supabase error on /properties: %s", res.error)
        raise HTTPException(status_code=502, detail=str(res.error))
    return res.data or []


@app.get("/properties/{property_id}")
async def get_property_by_id(property_id: str):
    sb = _sb()
    try:
        res = (
            sb.table("properties").select("*").eq("id", property_id).limit(1).execute()
        )
    except Exception as e:
        log.exception("Supabase exception on /properties/%s", property_id)
        raise HTTPException(status_code=502, detail="Database upstream error") from e
    if getattr(res, "error", None):
        log.error("Supabase error on /properties/%s: %s", property_id, res.error)
        raise HTTPException(status_code=502, detail=str(res.error))
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )
    return res.data[0]
