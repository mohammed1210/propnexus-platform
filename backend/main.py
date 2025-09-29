import logging
import os
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# -----------------------------------------------------------------------------
# Make "from routes.x import router" work on Railway/Docker
# -----------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# CORS  (TEMP: allow all while we stabilise — we can lock down after)
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TEMP: wide-open to kill CORS noise
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# A universal OPTIONS handler so preflight never hits your routers
# (some proxies can be picky; this avoids 502s on OPTIONS completely)
# -----------------------------------------------------------------------------
@app.options("/{full_path:path}")
def any_options(full_path: str) -> Response:
    return Response(status_code=204)


# -----------------------------------------------------------------------------
# Simple health check
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    # tiny hint in body to confirm we reached *this* process
    return {"ok": True, "port": os.getenv("PORT", "8080")}


# -----------------------------------------------------------------------------
# Basic request timing (helps on Railway edge 502 debugging)
# -----------------------------------------------------------------------------
@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0 = time()
    try:
        response = await call_next(request)
        return response
    finally:
        dt = (time() - t0) * 1000.0
        log.info("REQ %s %s -> %.1fms", request.method, request.url.path, dt)


# -----------------------------------------------------------------------------
# Mount routers (import safely + log clear reason if missing)
# -----------------------------------------------------------------------------
def try_mount(module: str, attr: str = "router", name: str | None = None):
    """Import routes.<module>:<attr> and include it if present."""
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
# Error handler for uniform JSON
# -----------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})


# -----------------------------------------------------------------------------
# Local dev entrypoint (Railway uses CMD below; this helps when running locally)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    log.info("Starting Uvicorn on port=%s", port)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, log_level="info")
