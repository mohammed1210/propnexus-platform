# backend/main.py
from __future__ import annotations

import logging
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.middleware.error_handler import ErrorHandlerMiddleware
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.routes import admin_schedule
from backend.routes.ai import router as ai_router
from backend.routes.area_intel_routes import router as area_intel_router
from backend.routes.comps_routes import router as comps_router
from backend.routes.debug_properties import router as debug_properties_router
from backend.routes.gpt_routes import router as gpt_router
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
from backend.utils.sentry_init import init_sentry

logger = logging.getLogger(__name__)

# Load env (safe if missing)
load_dotenv()

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
def health():
    """
    Health check endpoint with version information.
    Returns minimal system status without exposing secrets.
    """
    return {
        "status": "ok",
        "service": "propnexus-backend",
        "version": os.getenv("APP_VERSION", "unknown"),
        "environment": os.getenv("ENVIRONMENT", "development"),
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
app.include_router(gpt_router)
app.include_router(import_router)
app.include_router(notes_router)
app.include_router(off_market_router)
app.include_router(save_deal_router)
app.include_router(properties_router)
app.include_router(scrape_router)
app.include_router(tradesmen_router)
app.include_router(admin_schedule.router)

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
