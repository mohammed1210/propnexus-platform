import time
from typing import Optional, Dict, Any
from supabase import create_client
import os

_sb = None
if os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")):
    _sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY"))

class RunLog:
    def __init__(self, provider: str, location: str, meta: Optional[Dict[str, Any]] = None):
        self.provider = provider
        self.location = location
        self.meta = meta or {}
        self.start = time.time()
        self.run_id = None

    def start_run(self):
        if not _sb: return
        row = {
            "provider": self.provider, "location": self.location,
            "status": "running", "items_ingested": 0, "meta": self.meta
        }
        self.run_id = _sb.table("scrape_runs").insert(row).execute().data[0]["id"]

    def finish(self, status: str, items: int, err: str = "", extra: Optional[Dict[str, Any]] = None):
        if not _sb: return
        ms = int((time.time() - self.start) * 1000)
        upd = {
            "finished_at": "now()", "status": status,
            "items_ingested": items, "duration_ms": ms,
            "error_summary": err or None, "meta": {**self.meta, **(extra or {})}
        }
        _sb.table("scrape_runs").update(upd).eq("id", self.run_id).execute()
        