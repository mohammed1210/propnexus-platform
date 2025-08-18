# in backend/routes/scrape_routes.py
from fastapi import APIRouter
from scraper.zoopla_scraper import scrape_zoopla_properties
from scraper.rightmove_scraper import scrape_rightmove_properties

router = APIRouter()

@router.post("/scrape")
async def scrape_all(location: str):
    """Scrape both Zoopla & Rightmove for a given location."""
    zoopla_results = await scrape_zoopla_properties(location)
    rightmove_results = await scrape_rightmove_properties(location)

    # Combine + deduplicate by e.g. address or URL
    seen = set()
    merged = []
    for p in zoopla_results + rightmove_results:
        key = (p.get("title"), p.get("location"))
        if key not in seen:
            seen.add(key)
            merged.append(p)

    # Save into Supabase here if needed

    return {"count": len(merged), "properties": merged}