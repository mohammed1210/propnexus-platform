"""Simple in-memory rate limiter."""

import os
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Deque, Dict


class RateLimiter:
    def __init__(self, max_requests: int | None = None, window_seconds: int | None = None) -> None:
        # Use environment variables with defaults
        self.max_requests = max_requests or int(os.getenv("AI_RPS_MAX", "10"))
        self.window_seconds = window_seconds or int(os.getenv("AI_RPS_WINDOW", "60"))
        self._timestamps: Dict[str, Deque[datetime]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        """Return True if a request is allowed; otherwise False."""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        timestamps = self._timestamps[key]

        # Remove expired timestamps
        while timestamps and timestamps[0] < window_start:
            timestamps.popleft()

        if len(timestamps) >= self.max_requests:
            return False

        timestamps.append(now)
        return True


rate_limiter = RateLimiter()
