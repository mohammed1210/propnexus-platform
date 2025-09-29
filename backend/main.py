# backend/main.py
from __future__ import annotations

import logging
import sys
from pathlib import Path
from time import time
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ---- Make "from routes.x import router" work on Railway/Docker
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# ---- CORS: localhost + production + any Vercel preview for this project
ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://propnexus-platform.vercel.app",
}
# Accept previews like:
# https://propnexus-platform-git-<branch>-mohammed-abbas-projects-<hash>.vercel.app
ALLOWED_ORIGIN_REGEX = r"^https:\/\/propnexus-platform-git-[A-Za-z0-9._-]+-mohammed-abbas-projects-[A-Za-z0-9._-]+\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # <— TEMP ONLY
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Health
@app.get("/health")
def health():
    return {"ok": True}


# ---- Lightweight request timing (helps diagnose 502s)
@app.middleware("http")
async def timing_mw(request: Request, call_next):
    t0 = time()
    try:
        return await call_next(request)
    finally:
        dt = (time() - t0) * 1000.0
        log.info("REQ %s %s -> %.1fms", request.method, request.url.path, dt)


# ---- Safe router mount helper
def try_mount(module: str, attr: str = "router", name: Optional[str] = None):
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

# Optional routes
try_mount("area")
try_mount("comps")
try_mount("scrape")
try_mount("stripe_routes")


# ---- Uniform error handler (keeps Railway edge from showing internals)
@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})
