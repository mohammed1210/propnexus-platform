# backend/routes/scrape_routes.py
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from supabase import Client, create_client

# Package-relative imports so prod + local both work
from ..scraper.rightmove_scraper import scrape_rightmove_properties
from ..scraper.zoopla_scraper import scrape_zoopla_properties

router = APIRouter(tags=["scrape"])

# Optional Supabase write-through
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
sb: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_KEY)
    if (SUPABASE_URL and SUPABASE_KEY)
    else None
)


class ScrapeRequest(BaseModel):
    location: str


@router.post("/scrape")
async def scrape_all_sources(req: ScrapeRequest):
    """Run Zoopla + Rightmove scrapers, merge/dedupe, upsert to Supabase if configured."""
    location = (req.location or "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        zoopla = await scrape_zoopla_properties(location) or []
        rightmove = await scrape_rightmove_properties(location) or []

        combined = zoopla + rightmove
        seen: set[tuple] = set()
        unique_props: list[dict] = []
        for p in combined:
            key = (p.get("title"), p.get("price"), p.get("location"))
            if key not in seen:
                seen.add(key)
                unique_props.append(p)

        if sb and unique_props:
            try:
                sb.table("properties").upsert(unique_props).execute()
            except Exception as db_err:  # best-effort insert
                print("DB insert skipped:", db_err)

        return {"count": len(unique_props), "properties": unique_props}
    except HTTPException:
        raise
    except Exception as e:
        print("Scrape failed:", repr(e))
        raise HTTPException(status_code=500, detail="Scraping failed")
