# backend/routes/metrics_routes.py

"""
Routes providing basic health and metrics endpoints for monitoring.

This module defines two endpoints:

* `/health`  – returns a simple status to indicate the API is running.
* `/metrics` – returns lightweight usage metrics about the Supabase tables.

These endpoints are useful for uptime checks, Prometheus scraping or
any monitoring service you wish to integrate. They deliberately avoid
heavy computation so they can run frequently without degrading
performance.

Note: Supabase configuration values are pulled from the environment. If
SUPABASE_URL and the appropriate key are not set, the `/metrics`
endpoint will raise a 500 error to signal misconfiguration.
"""

import os

from fastapi import APIRouter, HTTPException

from supabase import create_client

router = APIRouter()

# Load Supabase credentials from environment. We support either the
# service role or anon key to allow flexibility across environments
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# Initialise the client if possible. If credentials are absent the
# client remains None and metrics will error.
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@router.get("/health")
async def health() -> dict[str, str]:
    """Simple health check endpoint.

    Returns a JSON object with a status key to indicate that the
    backend is reachable. Extend this if you need deeper checks.
    """
    return {"status": "ok"}


@router.get("/metrics")
async def metrics() -> dict[str, int]:
    """Return basic usage metrics for the backend.

    This endpoint counts the rows in a few core tables (properties,
    saved_deals and notes). It provides a quick way to verify that
    Supabase connectivity is working and to monitor growth over time.

    Raises:
        HTTPException: If Supabase credentials are not configured or
            if there is an error querying the database.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        props_count = len(
            supabase.table("properties").select("id").execute().data or []
        )
        saved_count = len(
            supabase.table("saved_deals").select("id").execute().data or []
        )
        notes_count = len(supabase.table("notes").select("id").execute().data or [])
        return {
            "properties": props_count,
            "saved_deals": saved_count,
            "notes": notes_count,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
