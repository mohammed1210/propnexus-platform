import os
from fastapi import APIRouter, Header, HTTPException
from ..tasks.cron_tasks import daily_scrape  # your stubbed job

router = APIRouter(prefix="/admin/schedule", tags=["admin"])


@router.post("/daily")
def trigger_daily(x_api_key: str = Header(None, alias="x-api-key")):
    if not x_api_key or x_api_key != os.getenv("OFF_MARKET_ADMIN_TOKEN"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    daily_scrape()
    return {"ok": True}
