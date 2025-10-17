from fastapi import APIRouter, HTTPException
from utils.email import send_email                     # ✅ ensure always imported
from backend.scraper.rightmove import scrape_rightmove
from backend.scraper.zoopla import scrape_zoopla

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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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

        return {"count": count, "properties": unique_props}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
