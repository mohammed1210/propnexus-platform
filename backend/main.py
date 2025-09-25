# backend/main.py
import importlib
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# -----------------------------------------------------------------------------
# CORS (Vercel preview + production + local)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://propnexus-platform.vercel.app",
    # preview deployments on vercel (git branches)
    "https://propnexus-platform-git-po2-mohammed1210.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",  # any vercel preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger("uvicorn.error")


# -----------------------------------------------------------------------------
# Lightweight request logging + guaranteed /health
# -----------------------------------------------------------------------------
@app.middleware("http")
async def _shim(request: Request, call_next):
    # Always respond to health quickly to prove the app is reachable
    if request.url.path in ("/health", "/api/health"):
        return JSONResponse({"ok": True})

    t0 = time.time()
    try:
        resp = await call_next(request)
        return resp
    finally:
        dt_ms = (time.time() - t0) * 1000.0
        log.info("REQ %s %s -> %.1fms", request.method, request.url.path, dt_ms)


@app.get("/health")
def health():
    return {"ok": True}


# -----------------------------------------------------------------------------
# Routers
# We include everything that's present, but don't crash if a module is missing.
# -----------------------------------------------------------------------------
def include_router_if_available(module_path: str, attr: str = "router"):
    try:
        module = importlib.import_module(module_path)
        router = getattr(module, attr)
        app.include_router(router)
        log.info("Router mounted: %s.%s", module_path, attr)
    except Exception as e:  # noqa: BLE001 - we want a soft failure + log
        log.warning("Router NOT mounted (%s): %s", module_path, e)


# Core routes used today
include_router_if_available("routes.off_market_routes")  # /off-market/...
include_router_if_available("routes.properties_routes")  # /properties/...
include_router_if_available("routes.saved_deals_routes")  # /saved-deals

# Other feature routers (mounted if present in the repo)
include_router_if_available("routes.save_deal")  # legacy save-deal
include_router_if_available("routes.notes")
include_router_if_available("routes.ai")
include_router_if_available("routes.area")
include_router_if_available("routes.comps")
include_router_if_available("routes.scrape")
include_router_if_available("routes.stripe")

# -----------------------------------------------------------------------------
# End
# -----------------------------------------------------------------------------
