# backend/main.py
from __future__ import annotations

import logging
import os
import socket
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# Make "routes.*" imports work on Railway/Docker
# -----------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# -----------------------------------------------------------------------------
# App & logger
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# CORS
# NOTE: allow_origins="*" cannot be combined with allow_credentials=True.
# Keep it permissive for now so preflights succeed; we can lock it down later.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TEMP: allow all (works with allow_credentials=False)
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True}


# -----------------------------------------------------------------------------
# Simple timing (helps debugging Railway edge retries)
# -----------------------------------------------------------------------------
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time()
    try:
        resp = await call_next(request)
        return resp
    finally:
        dt = (time() - t0) * 1000.0
        log.info("REQ %s %s -> %.1fms", request.method, request.url.path, dt)


# -----------------------------------------------------------------------------
# Mount routers (import safely + log reason if missing)
# -----------------------------------------------------------------------------
def try_mount(module: str, attr: str = "router", name: str | None = None):
    import importlib

    disp = name or module
    try:
        mod = importlib.import_module(f"routes.{module}")
        router = getattr(mod, attr)
        app.include_router(router)
        log.info("Router mounted: %s", disp)
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


# -----------------------------------------------------------------------------
# Debug helpers
# -----------------------------------------------------------------------------
@app.get("/_debug/env")
def debug_env():
    return {
        "ok": True,
        "port_env": os.getenv("PORT"),
        "hostname": socket.gethostname(),
    }


@app.on_event("startup")
def _startup_log():
    log.info("[startup] PORT=%r, HOSTNAME=%s", os.getenv("PORT"), socket.gethostname())


# -----------------------------------------------------------------------------
# Uniform error handler
# -----------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})
