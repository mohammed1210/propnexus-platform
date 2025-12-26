# backend/utils/runlog.py
import os
import sys
import time
import uuid
from typing import Optional, Dict, Any, List

try:
    from supabase import create_client
except Exception:  # pragma: no cover
    create_client = None


def _make_supabase_client():
    """Create Supabase client if env vars exist; otherwise return None."""
    if not create_client:
        return None

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None

    try:
        return create_client(url, key)
    except Exception:
        return None


_sb = _make_supabase_client()

# Ensure this module resolves to a single shared instance regardless of whether
# callers import it as `utils.runlog` (tests/runtime) or `backend.utils.runlog`.
_this_module = sys.modules[__name__]
sys.modules.setdefault("utils.runlog", _this_module)
sys.modules.setdefault("backend.utils.runlog", _this_module)

# In-memory run buffer for local/dev/test (so runlog tests can pass without Supabase)
_LOCAL_RUNS: List[Dict[str, Any]] = []


def get_local_runs() -> List[Dict[str, Any]]:
    """Return captured runs (dev/test only)."""
    return list(_LOCAL_RUNS)


def clear_local_runs() -> None:
    """Clear captured runs (dev/test only)."""
    _LOCAL_RUNS.clear()


class RunLog:
    """
    Context-manager style logger for scraper runs.

    - Writes to Supabase table `scrape_runs` if configured.
    - Always records an in-memory copy so tests/dev can validate run logging.

    Expected table columns used:
      provider, mode, location, status, properties_imported, meta, finished_at, duration_ms, error_summary
    """

    def __init__(
        self,
        source: str,
        mode: str,
        location: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        self.source = source
        self.mode = mode
        self.location = location
        self.meta = meta or {}

        self.start_ts = time.time()
        self.run_id: Optional[str] = None
        self.item_count = 0

        # Keep index into _LOCAL_RUNS so we can update it on finish
        self._local_index: Optional[int] = None

    def start_run(self) -> None:
        """Create run row (supabase if possible, else in-memory)."""
        row = {
            # Only set a real run id if Supabase is configured.
            # Tests expect run_id to remain None when Supabase is missing.
            "id": None,
            "provider": self.source,
            "mode": self.mode,
            "location": self.location,
            "status": "running",
            "properties_imported": 0,
            "meta": self.meta,
            "error_summary": None,
            "duration_ms": None,
            "finished_at": None,
        }

        # Always record locally
        _LOCAL_RUNS.append(row)
        self._local_index = len(_LOCAL_RUNS) - 1

        # Best-effort remote insert (don’t break runs if Supabase down)
        if not _sb:
            self.run_id = None
            return
        try:
            result = _sb.table("scrape_runs").insert(
                {
                    "provider": self.source,
                    "mode": self.mode,
                    "location": self.location,
                    "status": "running",
                    "properties_imported": 0,
                    "meta": self.meta,
                }
            ).execute()

            # If DB returns an id, prefer it
            if getattr(result, "data", None) and len(result.data) > 0:
                db_id = result.data[0].get("id")
                if db_id:
                    self.run_id = str(db_id)
                    # sync local
                    if self._local_index is not None:
                        _LOCAL_RUNS[self._local_index]["id"] = self.run_id
            else:
                self.run_id = None
        except Exception as e:
            # Don’t fail scraping because logging failed
            print(f"[RunLog] start_run supabase insert failed: {e}")
            self.run_id = None

    def finish(
        self,
        status: str,
        properties_found: int = 0,
        error_summary: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Mark run finished (supabase if possible, always local)."""
        duration_ms = int((time.time() - self.start_ts) * 1000)
        merged_meta = {**self.meta, **(extra or {})}

        # Update local first
        if self._local_index is not None and 0 <= self._local_index < len(_LOCAL_RUNS):
            _LOCAL_RUNS[self._local_index].update(
                {
                    "status": status,
                    "properties_imported": int(properties_found or 0),
                    "duration_ms": duration_ms,
                    "error_summary": (error_summary or None),
                    "meta": merged_meta,
                    "finished_at": "now()",
                }
            )

        # Remote update best-effort
        if not _sb or not self.run_id:
            return

        upd = {
            "status": status,
            "properties_imported": int(properties_found or 0),
            "duration_ms": duration_ms,
            "error_summary": (error_summary or None),
            "meta": merged_meta,
            # Supabase will interpret this if column type is timestamptz and PostgREST allows it
            "finished_at": "now()",
        }

        try:
            _sb.table("scrape_runs").update(upd).eq("id", self.run_id).execute()
        except Exception as e:
            print(f"[RunLog] finish supabase update failed: {e}")

    def set_count(self, items: int) -> None:
        """Update item count during run."""
        self.item_count = int(items or 0)

    def __enter__(self):
        self.start_run()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.finish(
                status="failed",
                properties_found=self.item_count,
                error_summary=str(exc_val),
            )
        else:
            self.finish(status="success", properties_found=self.item_count)
        return False

    @classmethod
    def start(
        cls,
        source: str,
        mode: str,
        location: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        """Convenience factory."""
        return cls(source=source, mode=mode, location=location, meta=meta)
    