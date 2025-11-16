import os
from fastapi import APIRouter, Header, HTTPException
from tasks.cron_tasks import daily_scrape  # your stubbed job
from utils.runlog import RunLog

router = APIRouter(prefix="/admin/schedule", tags=["admin"])


@router.post("/daily")
def trigger_daily(x_api_key: str = Header(None, alias="x-api-key")):
    """Trigger the daily scrape job and log the run."""
    if not x_api_key or x_api_key != os.getenv("OFF_MARKET_ADMIN_TOKEN"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Log the run
    log = RunLog(provider="daily_scrape", location="multi", source="admin_endpoint")
    log.start_run()
    
    try:
        daily_scrape()
        log.finish(status="success", items=0, extra={"trigger": "manual"})
        return {"ok": True, "run_id": log.run_id}
    except Exception as e:
        log.finish(status="failure", items=0, err=str(e))
        raise HTTPException(status_code=500, detail=f"Daily scrape failed: {str(e)}")
