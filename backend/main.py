# backend/main.py
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


# -----------------------------------------------------------------------------
# Helper: lazy/optional router import that won't crash if a module is missing
# -----------------------------------------------------------------------------
def _try_import(module_path: str, attr: str = "router") -> Optional[object]:
    try:
        module = __import__(module_path, fromlist=[attr])
        return getattr(module, attr)
    except Exception:
        return None


# Pre-resolve routers (all imports are still at top of file → Ruff happy)
off_market_router = _try_import("backend.routes.off_market_routes")
properties_router = _try_import("backend.routes.properties")
save_deal_router = _try_import("backend.routes.save_deal")
notes_router = _try_import("backend.routes.notes")
ai_router = _try_import("backend.routes.ai")
stripe_router = _try_import("backend.routes.stripe_routes")  # optional

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# CORS (Vercel preview + production + local)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://propnexus-platform.vercel.app",
    # preview branches on Vercel also allowed via regex below
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Lightweight request logging + guaranteed /health
# -----------------------------------------------------------------------------
@app.middleware("http")
async def _shim(request: Request, call_next):
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
# Router mounting (only if successfully imported)
# -----------------------------------------------------------------------------
def _mount(name: str, router: Optional[object]):
    if router is None:
        log.warning("Router NOT mounted (%s): import failed or module missing", name)
        return
    app.include_router(router)
    log.info("Router mounted: %s", name)


_mount("routes.off_market_routes", off_market_router)
_mount("routes.properties", properties_router)
_mount("routes.save_deal", save_deal_router)
_mount("routes.notes", notes_router)
_mount("routes.ai", ai_router)
_mount("routes.stripe_routes", stripe_router)
