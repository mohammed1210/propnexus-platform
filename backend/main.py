# backend/main.py
import logging
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# Ensure imports like "from routes.x import router" work on Railway/Docker
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
# CORS (Vercel preview + production + local)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS_EXACT = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://propnexus-platform.vercel.app",  # prod app (keep if/when you set it)
]

# Allow ANY Vercel preview, e.g. https://propnexus-platform-git-*.vercel.app
VERCEL_REGEX = r"^https?://([a-z0-9-]+\.)*vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS_EXACT,
    allow_origin_regex=VERCEL_REGEX,  # 🔓 all Vercel previews
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Simple health check
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True}


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


# Core routes (these should exist)
try_mount("off_market_routes")
try_mount("properties")  # <-- critical
try_mount("save_deal")
try_mount("notes")
try_mount("ai")

# Optional routes (ok if missing)
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
