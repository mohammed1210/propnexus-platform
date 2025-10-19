from fastapi import APIRouter, HTTPException
from backend.db import sb
import logging

router = APIRouter()

@router.post("/scrape")
async def scrape_all_sources(req: dict) -> dict:
    try:
        location = (req.get("location") or "").strip()
        if not location:
            raise HTTPException(status_code=400, detail="Missing location")

        # TODO: Replace with actual scraper logic
        logging.info("Scraping data for location: %s", location)

        # Dummy example for now
        results = [{"title": "Test Property", "price": 250000, "roi": 7.5}]
        return {"count": len(results), "properties": results}

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Scraping failed: %s", e)
        raise HTTPException(status_code=500, detail="Scraping failed")
