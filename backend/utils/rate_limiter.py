from __future__ import annotations

import asyncio
import threading
import time


class RateLimiter:
    """Simple global rate limiter (thread-safe).

    Allows 1 action per `min_interval_sec` across all callers.
    Suitable for polite throttling in a background worker.
    """

    def __init__(self, min_interval_sec: float = 1.0):
        self.min_interval_sec = float(min_interval_sec)
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.time()
            elapsed = now - self._last
            sleep_for = self.min_interval_sec - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
            self._last = time.time()


class AsyncRateLimiter:
    """Async global rate limiter.

    Avoids blocking the event loop while being polite with upstream APIs.
    """

    def __init__(self, min_interval_sec: float = 1.0):
        self.min_interval_sec = float(min_interval_sec)
        self._lock = asyncio.Lock()
        self._last = 0.0

    async def wait(self) -> None:
        async with self._lock:
            now = time.time()
            elapsed = now - self._last
            sleep_for = self.min_interval_sec - elapsed
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
            self._last = time.time()
