# backend/main.py
from __future__ import annotations

import logging
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# Make "from routes.* import router" work both locally and on Railway
# -----------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# -----------------------------------------------------------------------------
# App + logger
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# CORS
#   - Explicit allowlist for localhost + production
#   - Regex for ANY Vercel preview under *.vercel.app (e.g. your git-po2 URL)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://propnexus-platform-git-po2-mohammed-abbas-projects-8ab7e126.vercel.app"
    "https://propnexus-platform.vercel.app",  # production app domain (adjust if different)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.+\.vercel\.app$",  # matches all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],  # includes automatic handling of OPTIONS preflight
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True}


# -----------------------------------------------------------------------------
# Simple timing log for each request (helps diagnose Railway 502s)
# -----------------------------------------------------------------------------
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time()
    try:
        return await call_next(request)
    finally:
        ms = (time() - t0) * 1000.0
        log.info("REQ %s %s -> %.1fms", request.method, request.url.path, ms)


# -----------------------------------------------------------------------------
# Router mounting (import robustly; log if missing but keep server up)
# -----------------------------------------------------------------------------
def try_mount(module: str, attr: str = "router", name: str | None = None):
    import importlib

    label = name or module
    try:
        mod = importlib.import_module(f"routes.{module}")
        router = getattr(mod, attr)
        app.include_router(router)
        log.info("Router mounted: %s", label)
    except Exception as exc:
        log.warning("Router NOT mounted (%s): %s", f"routes.{module}", exc)


# Core routes
try_mount("off_market_routes")
try_mount("properties")
try_mount("save_deal")
try_mount("notes")
try_mount("ai")

# Optional routes (fine if absent)
try_mount("area")
try_mount("comps")
try_mount("scrape")
try_mount("stripe_routes")


# -----------------------------------------------------------------------------
# Fallback error handler
# -----------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})
