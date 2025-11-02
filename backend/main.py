# backend/main.py
from __future__ import annotations
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

# ✅ Give Stripe routers distinct names
from .routes.stripe_webhook import router as stripe_webhook_router   # /stripe/webhook
from .routes.stripe_routes import router as stripe_routes_router     # /stripe/create-portal-session
# If you also have a separate stripe_portal.py, keep it; otherwise remove the import below
# from .routes.stripe_portal import router as stripe_portal_router

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
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

# ✅ Stripe routes (exactly once each)
app.include_router(stripe_webhook_router)   # POST /stripe/webhook
app.include_router(stripe_routes_router)    # POST /stripe/create-portal-session
# app.include_router(stripe_portal_router)

@app.get("/")
def root():
    return {"ok": True}
