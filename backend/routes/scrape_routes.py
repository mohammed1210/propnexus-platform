from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client  # type: ignore

try:
    from backend.scraper.rightmove_scraper import scrape_rightmove_properties
    from backend.scraper.zoopla_scraper import scrape_zoopla_properties
except Exception:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel
    from scraper.rightmove_scraper import scrape_rightmove_properties
    from scraper.zoopla_scraper import scrape_zoopla_properties
    from utils.email import send_email
    from utils.supabase import supabase as sb

    from supabase import Client, create_client

supabase: Client | None = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:  # pragma: no cover
    logging.warning("Supabase init failed: %s", e)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:  # pragma: no cover
    logging.warning("Supabase init failed: %s", e)

router = APIRouter()


@router.post("/scrape-rightmove")
async def scrape_rightmove_route(payload: dict):
    try:
        unique_props = await scrape_rightmove(payload)
        count = len(unique_props)

        # ✅ send notification after successful scrape
        await send_email(
            "abbas_m90@hotmail.com",
            "Scrape Completed",
            f"{count} properties scraped successfully from Rightmove."
        )

        return {"count": count, "properties": unique_props}

    try:

        zoopla_results = scrape_zoopla_properties(location) or []
        rightmove_results = scrape_rightmove_properties(location) or []


@router.post("/scrape-zoopla")
async def scrape_zoopla_route(payload: dict):
    try:
        unique_props = await scrape_zoopla(payload)
        count = len(unique_props)

        # ✅ same notification for Zoopla
        await send_email(
            "abbas_m90@hotmail.com",
            "Scrape Completed",
            f"{count} properties scraped successfully from Zoopla."
        )

    count = len(unique_props)

        # ✅ same notification for Zoopla
        await send_email(
            "abbas_m90@hotmail.com",
            "Scrape Completed",
            f"{count} properties scraped successfully from Zoopla."
        )

        return {"count": count, "properties": unique_props}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
