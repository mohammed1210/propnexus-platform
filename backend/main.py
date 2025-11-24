# backend/main.py
from __future__ import annotations
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize Sentry before other imports
try:
    from backend.utils.sentry_init import init_sentry

    init_sentry()
except Exception as e:
    print(f"[WARNING] Sentry initialization failed: {e}")

# Local routers
from .routes.ai import router as ai_router
from .routes.area_intel_routes import router as area_intel_router
from .routes.comps_routes import router as comps_router
from .routes.gpt_routes import router as gpt_router
from .routes.health import router as health_router
from .routes.import_routes import router as import_router
from .routes.notes import router as notes_router
from .routes.off_market_routes import router as off_market_router
from .routes.save_deal import router as save_deal_router
from .routes.properties_routes import router as properties_router
from .routes.tradesmen_routes import router as tradesmen_router
from .routes.users_routes import router as users_router
from backend.routes import import_routes, admin_schedule

# ✅ Stripe routers (named distinctly to avoid duplicate includes)
from .routes.stripe_webhook import router as stripe_webhook_router  # POST /stripe/webhook
from .routes.stripe_routes import (
    router as stripe_routes_router,
)  # POST /stripe/create-portal-session

# Note: Additional route files exist but are not yet integrated:
# - digests_routes.py, email_routes.py, metrics_routes.py, payments_routes.py
# These may be activated in future releases when the features are ready.
# - scrape_routes.py is deprecated in favor of import_routes.py

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

app = FastAPI()

_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://propnexus-platform.vercel.app",
)
ALLOWED_ORIGINS = [o.strip() for o in _ALLOWED_ORIGINS.split(",") if o.strip()]

# Allow all Vercel preview deployments with regex pattern
# Matches https://[subdomain].vercel.app where subdomain contains alphanumeric
# characters and hyphens (RFC 1035 compliant, max 63 chars per DNS label)
VERCEL_ORIGIN_REGEX = r"^https://[a-zA-Z0-9-]{1,63}\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=VERCEL_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routers
app.include_router(ai_router)
app.include_router(area_intel_router)
app.include_router(comps_router)
app.include_router(gpt_router)
app.include_router(health_router)
app.include_router(import_router)
app.include_router(notes_router)
app.include_router(off_market_router)
app.include_router(save_deal_router)
# Legacy scrape_router removed - use import_router instead
app.include_router(properties_router)  # GET /properties
app.include_router(tradesmen_router)  # GET /tradesmen/nearby, POST /tradesmen/contact
app.include_router(import_routes.router)
app.include_router(admin_schedule.router)

# ✅ Stripe (include exactly once each)
app.include_router(stripe_webhook_router)  # POST /stripe/webhook
app.include_router(stripe_routes_router)  # POST /stripe/create-portal-session

# ✅ Users router
app.include_router(users_router)  # GET /users/plan


# ======================
# 🏠 Root Route
# ======================
@app.get("/")
def root():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port)
