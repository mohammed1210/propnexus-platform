from __future__ import annotations

import asyncio
import threading
import time
import traceback
from typing import Any, Optional

from backend.services.enrichment_service import compute_and_store_enrichment
from backend.utils.enrichment_queue import fetch_next_job, mark_done, mark_failed, mark_processing


class EnrichmentWorker:
    def __init__(
        self,
        supabase: Any,
        *,
        poll_interval_sec: float = 2.0,
    ):
        self.supabase = supabase
        self.poll_interval_sec = float(poll_interval_sec)
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                job = fetch_next_job(self.supabase)
                if not job:
                    time.sleep(self.poll_interval_sec)
                    continue

                job_id = int(job["id"])
                property_id = str(job["property_id"])
                attempts = int(job.get("attempts") or 0) + 1

                mark_processing(self.supabase, job_id)

                try:
                    asyncio.run(
                        compute_and_store_enrichment(
                            sb=self.supabase,
                            property_id=property_id,
                            force=False,
                            ttl_hours=24,
                        )
                    )
                    mark_done(self.supabase, job_id)
                except Exception as e:
                    backoff = [10, 30, 60, 120, 300][min(attempts - 1, 4)]
                    mark_failed(self.supabase, job_id, attempts, str(e), backoff)

            except Exception:
                traceback.print_exc()
                time.sleep(3)
