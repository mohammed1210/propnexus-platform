import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from scraper.rightmove_scraper import scrape_rightmove_properties
from scraper.zoopla_scraper import scrape_zoopla_properties
from supabase import Client, create_client

# ✅ Load Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()


class ScrapeRequest(BaseModel):
    location: str


@router.post("/scrape")
async def scrape_all_sources(req: ScrapeRequest):
    """
    Unified scrape endpoint — runs Zoopla + Rightmove scrapers,
    merges results, saves to Supabase, and returns them.
    """
    location = req.location.strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        # Run both scrapers
        zoopla_results = scrape_zoopla_properties(location) or []
        rightmove_results = scrape_rightmove_properties(location) or []

        # Merge + deduplicate
        combined = zoopla_results + rightmove_results
        seen = set()
        unique_props = []
        for p in combined:
            key = (p.get("title"), p.get("price"), p.get("location"))
            if key not in seen:
                seen.add(key)
                unique_props.append(p)

        # Save to Supabase (ignore errors if already exists)
        if unique_props:
            try:
                supabase.table("properties").upsert(unique_props).execute()
            except Exception as db_err:
                print("⚠️ DB insert skipped:", db_err)

        return {"count": len(unique_props), "properties": unique_props}

    except Exception as e:
        print("❌ Scrape failed:", e)
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
