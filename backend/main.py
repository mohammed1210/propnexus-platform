# backend/main.py
import logging
import os
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

# -----------------------------------------------------------------------------
# Ensure imports like "from routes.x import router" work on Railway/Docker
# -----------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

app = FastAPI(title="PropNexus Backend", version="0.2.0")
log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# CORS: localhost + vercel + previews (relaxed enough for PO2)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # main prod
    "https://propnexus-platform.vercel.app",
}
# Accept previews like:
# https://propnexus-platform-git-<branch>-mohammed-abbas-projects-<hash>.vercel.app
ALLOWED_ORIGIN_REGEX = r"^https:\/\/propnexus-platform-git-[A-Za-z0-9._-]+-mohammed-abbas-projects-[A-Za-z0-9._-]+\.vercel\.app$"

# For PO2 we allow "*" (keeps preflight simple) but still log Origin for visibility.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)


# -----------------------------------------------------------------------------
# Health & tiny debug
# -----------------------------------------------------------------------------
@app.get("/health", response_class=PlainTextResponse)
def health() -> str:
    return "OK"


@app.get("/_debug/echo")
def echo(origin: str | None = None):
    return {
        "ok": True,
        "origin_param": origin,
        "env": {"PORT": os.getenv("PORT"), "HOSTNAME": os.getenv("HOSTNAME")},
    }


# -----------------------------------------------------------------------------
# Basic request timing (helps on Railway edge 5xx debugging)
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
# Mount routers (import safely + log clear reason if missing)
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
# Optional
try_mount("area")
try_mount("comps")
try_mount("scrape")
try_mount("stripe_routes")


# -----------------------------------------------------------------------------
# Uniform error handler
# -----------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})


# Log binding info at startup (helps confirm Railway port)
@app.on_event("startup")
def _startup_log():
    log.info("[startup] PORT=%r, HOSTNAME=%s", os.getenv("PORT"), os.getenv("HOSTNAME"))
