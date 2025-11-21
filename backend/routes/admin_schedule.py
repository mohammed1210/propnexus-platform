import os
from fastapi import APIRouter, Header, HTTPException
from tasks.cron_tasks import daily_scrape  # your stubbed job
from backend.utils.runlog import RunLog
from backend.utils.alerts import check_scrape_anomaly

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
        # Note: In a real implementation, we'd get actual property counts from daily_scrape()
        # For now, we log success without anomaly check
        log.finish(status="success", items=0, extra={"trigger": "manual"})
        return {"ok": True, "run_id": log.run_id}
    except Exception as e:
        log.finish(status="failure", items=0, err=str(e))
        # Send alert on failure
        check_scrape_anomaly(
            provider="daily_scrape",
            location="multi",
            properties_count=0,
        )
        raise HTTPException(status_code=500, detail=f"Daily scrape failed: {str(e)}")
