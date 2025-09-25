from __future__ import annotations

import logging
import os
from typing import Optional

# Shared Supabase client (HTTP/1.1)
from db import make_supabase
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from httpx import RemoteProtocolError

# Routers
from routes.off_market_routes import router as off_market_router

from supabase import Client

logger = logging.getLogger("uvicorn")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# ---------------- App & middleware ----------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")


# Short-circuit /health at the very edge so we can see traffic even when upstreams fail
@app.middleware("http")
async def _tiny_health_bypass(request, call_next):
    if request.url.path in ("/health", "/api/health"):
        return JSONResponse({"ok": True})
    return await call_next(request)


# CORS
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://propnexus-platform.vercel.app",
    "https://propnexus-platform-git-po2-mohammed1210.vercel.app",
]
allow_origin_regex = r"^https://.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Supabase ----------------
supabase: Optional[Client] = make_supabase()
if supabase:
    logger.info("Supabase client created (http2 disabled)")
else:
    logger.warning("Supabase env not configured; DB endpoints will 500")

# ---------------- Routers ----------------
app.include_router(off_market_router)


# ---------------- Simple endpoints ----------------
@app.get("/")
def root():
    return {"ok": True, "service": "propnexus-backend"}


@app.get("/health")
def health():
    # Will be intercepted by middleware above, but keep handler for completeness
    return {"ok": True}


@app.get("/saved-deals")
def list_saved_deals():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        res = (
            supabase.table("saved_deals")
            .select("*")
            .order("saved_at", desc=True)
            .execute()
        )
        return {"data": res.data or []}
    except Exception as e:
        logger.exception("Saved deals query failed")
        raise HTTPException(status_code=502, detail=f"Database upstream error: {e}")


@app.get("/properties/{property_id}")
def get_property_by_id(property_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        res = (
            supabase.table("properties")
            .select("*")
            .eq("id", property_id)
            .limit(1)
            .execute()
        )
        data = res.data or []
        if not data:
            raise HTTPException(status_code=404, detail="Property not found")
        return data[0]
    except RemoteProtocolError:
        # What was causing intermittent 502s before forcing HTTP/1.1
        raise HTTPException(status_code=502, detail="Database upstream error")
    except Exception as e:
        logger.exception("Property fetch failed")
        raise HTTPException(status_code=502, detail=f"Database upstream error: {e}")
