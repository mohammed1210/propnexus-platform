# backend/main.py
from __future__ import annotations

import logging
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# ruff: noqa: E402


logger = logging.getLogger(__name__)

# Load env early (safe if missing)
# NOTE: Some internal modules initialize clients (e.g. Supabase) at import time.
# Loading dotenv after importing them would prevent local .env values from taking effect.
load_dotenv()

from backend.middleware.error_handler import ErrorHandlerMiddleware
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.routes import admin_schedule
from backend.routes.admin_scrape_runs import router as admin_scrape_runs_router
from backend.routes.ai import router as ai_router
from backend.routes.area_intel_routes import router as area_intel_router
from backend.routes.comps_routes import router as comps_router
from backend.routes.debug_properties import router as debug_properties_router
from backend.routes.debug_scrape_probe import router as debug_scrape_probe_router
from backend.routes.gpt_routes import router as gpt_router
from backend.routes.import_routes import admin_alias_router
from backend.routes.import_routes import router as import_router
from backend.routes.notes import router as notes_router
from backend.routes.off_market_routes import router as off_market_router
from backend.routes.properties_routes import router as properties_router
from backend.routes.save_deal import router as save_deal_router
from backend.routes.scrape_routes import router as scrape_router
from backend.routes.stripe_routes import router as stripe_routes_router
from backend.routes.stripe_webhook import router as stripe_webhook_router
from backend.routes.tradesmen_routes import router as tradesmen_router
from backend.routes.users_routes import router as users_router
from backend.routes.waitlist_routes import admin_router as admin_waitlist_router
from backend.routes.waitlist_routes import router as waitlist_router
from backend.utils.sentry_init import init_sentry

# Initialize Sentry (only enables in prod + DSN configured)
try:
    init_sentry()
except Exception as e:
    logger.warning(f"Sentry initialization failed: {e}")

app = FastAPI()

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add security middleware (applied in order)
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


# ======================
# ❤️ Health Check (DO NOT MOVE)
# ======================
@app.get("/health")
def health(response: Response):
    """
    Health check endpoint with version information.
    Returns minimal system status without exposing secrets.
    """
    version = (
        os.getenv("APP_VERSION")
        or os.getenv("RAILWAY_GIT_COMMIT_SHA")
        or os.getenv("GIT_COMMIT_SHA")
        or os.getenv("GIT_SHA")
        or "unknown"
    )
    environment = os.getenv("ENVIRONMENT") or os.getenv("RAILWAY_ENVIRONMENT") or "development"

    # Marker header to correlate deploy + response normalization behavior.
    # Kept intentionally stable for curl-based runbooks.
    response.headers["X-PropNexus-Properties-Normalization"] = "v1"
    return {
        "status": "ok",
        "service": "propnexus-backend",
        "version": version,
        "environment": environment,
    }


# ======================
# 🌍 CORS (stable for prod + previews)
# ======================
_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://propnexus-platform.vercel.app",
)

ALLOWED_ORIGINS = [o.strip() for o in _ALLOWED_ORIGINS.split(",") if o.strip()]

# Allow any Vercel preview like https://propnexus-platform-git-xyz.vercel.app
ALLOW_ORIGIN_REGEX = os.getenv(
    "ALLOW_ORIGIN_REGEX",
    r"^https:\/\/.*(\.vercel\.app|\.app\.github\.dev|\.github\.dev)$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================
# 🧪 Debug Routes (Safe)
# ======================
@app.get("/debug/supabase-env")
def debug_supabase_env():
    """
    Shows what the container is *actually* reading.
    Does NOT expose full secrets.
    """
    url = (os.getenv("SUPABASE_URL") or "").strip()

    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()

    try:
        host = urlparse(url).netloc or url
    except Exception:
        host = url

    return {
        "SUPABASE_URL_present": bool(url),
        "SUPABASE_URL_host": host,
        "key_present": bool(key),
        "key_len": len(key),
        "key_prefix": key[:8] if key else "",
        "checked_vars_order": [
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_SERVICE_ROLE",
            "SUPABASE_KEY",
            "SUPABASE_ANON_KEY",
        ],
    }


@app.get("/debug/scraper-env")
def debug_scraper_env():
    """Expose scraper configuration in a safe way (no secrets)."""

    scraper_mode = (os.getenv("SCRAPER_MODE") or "direct").strip()
    scraperapi_key = (os.getenv("SCRAPERAPI_KEY") or "").strip()
    return {
        "SCRAPER_MODE": scraper_mode,
        "SCRAPER_TIMEOUT_SECONDS": os.getenv("SCRAPER_TIMEOUT_SECONDS", "20"),
        "INGEST_TIMEOUT_SECONDS": os.getenv("INGEST_TIMEOUT_SECONDS", ""),
        "SCRAPERAPI_KEY_present": bool(scraperapi_key),
        "SCRAPERAPI_KEY_len": len(scraperapi_key),
        "SCRAPERAPI_KEY_prefix": scraperapi_key[:6] if scraperapi_key else "",
        "PLAYWRIGHT_ENABLE": os.getenv("PLAYWRIGHT_ENABLE", "0") == "1",
        "PLAYWRIGHT_BROWSER": os.getenv("PLAYWRIGHT_BROWSER", "chromium"),
        "PLAYWRIGHT_TIMEOUT_MS": os.getenv("PLAYWRIGHT_TIMEOUT_MS", "15000"),
        "ZP_MAX_PAGES": os.getenv("ZP_MAX_PAGES", "1"),
        "RM_MAX_PAGES": os.getenv("RM_MAX_PAGES", "1"),
        "OTM_MAX_PAGES": os.getenv("OTM_MAX_PAGES", "1"),
        "SR_MAX_PAGES": os.getenv("SR_MAX_PAGES", "1"),
    }


@app.get("/debug/routes")
def debug_routes():
    """Return a sorted list of registered paths.

    This helps confirm route registration in production without relying only on OpenAPI.
    """

    paths: set[str] = set()
    detailed: list[dict] = []

    for r in app.routes:
        if not isinstance(r, APIRoute):
            continue
        paths.add(r.path)
        detailed.append(
            {
                "path": r.path,
                "methods": sorted([m for m in (r.methods or set()) if m]),
                "name": r.name,
            }
        )

    return {
        "count": len(paths),
        "paths": sorted(paths),
        "routes": sorted(detailed, key=lambda x: x["path"]),
    }


# ======================
# 🏠 Root Route
# ======================
@app.get("/")
def root():
    return {"ok": True, "service": "propnexus-backend"}


# ======================
# 🔌 Routers
# ======================
app.include_router(ai_router)
app.include_router(area_intel_router)
app.include_router(comps_router)
app.include_router(debug_properties_router)
app.include_router(debug_scrape_probe_router)
app.include_router(gpt_router)
app.include_router(import_router)
app.include_router(admin_alias_router)
app.include_router(admin_scrape_runs_router)
app.include_router(notes_router)
app.include_router(off_market_router)
app.include_router(save_deal_router)
app.include_router(properties_router)
app.include_router(scrape_router)
app.include_router(tradesmen_router)
app.include_router(admin_schedule.router)

# Waitlist
app.include_router(waitlist_router)
app.include_router(admin_waitlist_router)

# Stripe
app.include_router(stripe_webhook_router)
app.include_router(stripe_routes_router)

# Users
app.include_router(users_router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port)


# Trigger rebuild (DO NOT REMOVE)
REBUILD_FLAG = "2025-11-25"
