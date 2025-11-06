# backend/main.py
from __future__ import annotations
import os

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
from .routes.scrape_routes import router as scrape_router
from .routes.properties_routes import router as properties_router

# ✅ Stripe routers (named distinctly to avoid duplicate includes)
from .routes.stripe_webhook import router as stripe_webhook_router        # POST /stripe/webhook
from .routes.stripe_routes import router as stripe_routes_router          # POST /stripe/create-portal-session
from .routes.users_routes import router as users_router                   # GET /users/plan

# Users router
from .routes.users_routes import router as users_router                    # GET /users/plan

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

app = FastAPI()

_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://propnexus-platform.vercel.app,https://*.vercel.app",
)
ALLOWED_ORIGINS = [o.strip() for o in _ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
app.include_router(scrape_router)
app.include_router(properties_router)   # GET /properties

# ✅ Stripe (include exactly once each)
app.include_router(stripe_webhook_router)   # POST /stripe/webhook
app.include_router(stripe_routes_router)    # POST /stripe/create-portal-session

# ✅ Users router
app.include_router(users_router)            # GET /users/plan

# ======================
# 🏠 Root Route
# ======================
@app.get("/")
def root():
    return {"ok": True}
