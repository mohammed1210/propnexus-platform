# backend/main.py
import importlib
import logging
import time
from typing import Iterable, Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

log = logging.getLogger("uvicorn.error")

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(title="PropNexus Backend", version="0.1.0")

# -----------------------------------------------------------------------------
# CORS (local + production + any vercel preview)
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "https://propnexus-platform.vercel.app",
    # keep a known preview you use often; regex below will allow all others
    "https://propnexus-platform-git-po2-mohammed-abbas-projects-8ab7e126.vercel.app",
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
# Lightweight request timing + /health
# -----------------------------------------------------------------------------
@app.middleware("http")
async def _shim(request: Request, call_next):
    # very fast health
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
# Router mounting (tolerant to either 'backend.routes.X' or 'routes.X')
# -----------------------------------------------------------------------------
def _first_import(module_candidates: Iterable[str]) -> Optional[object]:
    last_exc: Optional[Exception] = None
    for mod in module_candidates:
        try:
            return importlib.import_module(mod)
        except Exception as e:  # noqa: BLE001
            last_exc = e
    if last_exc:
        raise last_exc
    return None


def mount_router(name: str, attr: str = "router"):
    """
    Try to import a router module from both package layouts and include it if present.
    """
    candidates = (f"backend.routes.{name}", f"routes.{name}")
    try:
        module = _first_import(candidates)
        router = getattr(module, attr)
        app.include_router(router)
        log.info("Router mounted: %s", name)
    except Exception as e:  # noqa: BLE001
        log.warning(
            "Router NOT mounted (%s): import failed or module missing", f"routes.{name}"
        )
        log.debug("Mount failure for %s: %r", name, e)


# Core/active routers
mount_router("off_market_routes")  # /off-market/...
mount_router("properties")  # /properties/...
mount_router("save_deal")  # /save-deal
mount_router("notes")  # /notes
mount_router("ai")  # /ai
mount_router("stripe_routes")  # /stripe (if present)

# Optional/experimental (silently skipped if not present)
mount_router("area")
mount_router("comps")
mount_router("scrape")
