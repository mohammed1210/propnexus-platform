# backend/routes/scrape_routes.py
# Package-first imports for scrapers with fallback

# (fallback to relative)
import os

try:
    from backend.scraper.rightmove_scraper import scrape_rightmove_properties
    from backend.scraper.zoopla_scraper import scrape_zoopla_properties
except Exception:
    from scraper.rightmove_scraper import scrape_rightmove_properties
    from scraper.zoopla_scraper import scrape_zoopla_properties

    from utils.supabase import supabase as sb
    from fastapi import APIRouter, HTTPException
    from utils.email import send_email
    from pydantic import BaseModel
    from supabase import Client, create_client

# Import scrapers relative to backend package

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:  # pragma: no cover
    logging.warning("Supabase init failed: %s", e)

router = APIRouter()


class ScrapeRequest(BaseModel):
    location: str


@router.post("/scrape")
async def scrape_all_sources(req: ScrapeRequest) -> dict:
    location = (req.location or "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
       
        zoopla_results = scrape_zoopla_properties(location) or []
        rightmove_results = scrape_rightmove_properties(location) or []

        combined = zoopla_results + rightmove_results
        seen: set[tuple] = set()
        unique_props: list[dict] = []

        for p in combined:
            key = (p.get("title"), p.get("price"), p.get("location"))
            if key not in seen:
                seen.add(key)
                unique_props.append(p)

        if supabase and unique_props:
            try:
                supabase.table("properties").upsert(unique_props).execute()
            except Exception as db_err:  # pragma: no cover
                logging.warning("DB insert skipped: %s", db_err)

    count = len(unique_props)
            
            await send_email("Scrape Completed", f"{count} new properties added to PropNexus.")
         
       return {"count": len(unique_props), "properties": unique_props}

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        logging.exception("Scraping failed: %s", e)
        raise HTTPException(status_code=500, detail="Scraping failed")
