import time
from typing import Optional, Dict, Any
from supabase import create_client
import os

_sb = None
if os.getenv("SUPABASE_URL") and (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
):
    _sb = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY"),
    )


class RunLog:
    """Context-manager style logger for scraper runs.

    Usage:
        log = RunLog(source="rightmove", mode="direct", location="London")
        log.start_run()
        try:
            # ... scraping logic ...
            log.finish(status="success", properties_found=count)
        except Exception as e:
            log.finish(status="failed", properties_found=0, error_summary=str(e))

    Or as context manager:
        with RunLog.start(source="rightmove", mode="direct", location="London") as log:
            # ... scraping logic ...
            log.set_count(items)
    """

    def __init__(
        self,
        source: str,
        mode: str,
        location: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        self.source = source  # 'rightmove', 'zoopla', 'otm', 'spareroom'
        self.mode = mode  # 'direct', 'scraperapi', 'smart'
        self.location = location
        self.meta = meta or {}
        self.start = time.time()
        self.run_id = None
        self.item_count = 0

    def start_run(self):
        if not _sb:
            return
        row = {
            "provider": self.source,  # Map to provider column (backward compat)
            "mode": self.mode,
            "location": self.location,
            "status": "running",
            "properties_imported": 0,
            "meta": self.meta,
        }
        try:
            result = _sb.table("scrape_runs").insert(row).execute()
            if result.data and len(result.data) > 0:
                self.run_id = result.data[0]["id"]
        except Exception as e:
            print(f"[RunLog] Failed to start run: {e}")

    def finish(
        self,
        status: str,
        properties_found: int = 0,
        error_summary: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ):
        if not _sb or not self.run_id:
            return
        ms = int((time.time() - self.start) * 1000)
        upd = {
            "finished_at": "now()",
            "status": status,
            "properties_imported": properties_found,
            "duration_ms": ms,
            "error_summary": error_summary or None,
            "meta": {**self.meta, **(extra or {})},
        }
        try:
            _sb.table("scrape_runs").update(upd).eq("id", self.run_id).execute()
        except Exception as e:
            print(f"[RunLog] Failed to finish run: {e}")

    def set_count(self, items: int):
        """Update item count during run"""
        self.item_count = items

    def __enter__(self):
        self.start_run()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.finish(
                status="failed", properties_found=self.item_count, error_summary=str(exc_val)
            )
        else:
            self.finish(status="success", properties_found=self.item_count)
        return False  # Don't suppress exceptions

    @classmethod
    def start(
        cls,
        source: str,
        mode: str,
        location: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        """Convenience factory for use as context manager"""
        return cls(source=source, mode=mode, location=location, meta=meta)
