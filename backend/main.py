# backend/main.py
import logging
import os
import sys
from pathlib import Path
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

# ensure "routes.*" imports work
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

app = FastAPI(title="PropNexus Backend", version="0.1.0")
log = logging.getLogger("uvicorn.error")

# TEMP: permissive CORS so we can debug without noise
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# always answer preflight
@app.options("/{path:path}")
def _any_options(path: str) -> Response:
    return Response(status_code=204)


@app.get("/health")
def health():
    return {"ok": True, "port": os.getenv("PORT", "8080")}


@app.middleware("http")
async def timing(request: Request, call_next):
    t0 = time()
    try:
        resp = await call_next(request)
        return resp
    finally:
        log.info(
            "REQ %s %s -> %.1fms",
            request.method,
            request.url.path,
            (time() - t0) * 1000,
        )


# safe router mount helper
def try_mount(module: str, attr: str = "router"):
    import importlib

    try:
        mod = importlib.import_module(f"routes.{module}")
        app.include_router(getattr(mod, attr))
        log.info("Router mounted: %s", module)
    except Exception as exc:
        log.warning("Router NOT mounted (routes.%s): %s", module, exc)


# core
try_mount("off_market_routes")
try_mount("properties")
try_mount("save_deal")
try_mount("notes")
try_mount("ai")
# optional
try_mount("area")
try_mount("comps")
try_mount("scrape")
try_mount("stripe_routes")


@app.exception_handler(Exception)
async def unhandled(_req: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "Server error"})


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    log.info("Starting Uvicorn on port=%s", port)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, log_level="info")
