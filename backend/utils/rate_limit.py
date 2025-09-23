"""Simple in-memory rate limiter for AI endpoints.

Each unique key (e.g., IP address or API key) is allowed a maximum number of
calls within a time window. Configured via environment variables:
- AI_RPS_WINDOW: window size in seconds (default 60)
- AI_RPS_MAX: max number of calls in the window (default 10)

This limiter is not persistent and should not be used for production-grade
rate limiting in distributed environments.
"""

import os
import time
from collections import defaultdict, deque
from typing import Deque, DefaultDict

# Configuration from environment variables with fallbacks
AI_RPS_WINDOW: int = int(os.getenv("AI_RPS_WINDOW", "60"))
AI_RPS_MAX: int = int(os.getenv("AI_RPS_MAX", "10"))


class RateLimiter:
    """In-memory rate limiter using a deque of timestamps per key."""

    def __init__(self) -> None:
        # Mapping of key -> deque of call timestamps
        self.calls: DefaultDict[str, Deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, max_calls: int = AI_RPS_MAX, window: int = AI_RPS_WINDOW) -> bool:
        """Check if a call is allowed for the given key.

        Args:
            key: A unique identifier for the caller (e.g., IP or API token).
            max_calls: Maximum number of calls allowed within the window.
            window: Time window in seconds.

        Returns:
            True if the call is allowed, False if the rate limit has been exceeded.
        """
        now = time.time()
        calls = self.calls[key]
        # Purge timestamps outside the current window
        while calls and calls[0] <= now - window:
            calls.popleft()

        if len(calls) >= max_calls:
            return False

        calls.append(now)
        return True
