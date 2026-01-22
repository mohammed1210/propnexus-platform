# backend/middleware/rate_limit.py
"""
Rate limiting configuration using slowapi.

IMPORTANT:
- In CI / pytest, tests can hit endpoints extremely quickly and trip limits.
- We automatically relax limits in test environments to avoid false failures.
"""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def is_test_or_ci() -> bool:
    # PYTEST_CURRENT_TEST is set by pytest for each test
    return (
        os.getenv("CI", "").lower() == "true"
        or os.getenv("ENVIRONMENT", "").lower() in {"test", "ci"}
        or os.getenv("PYTEST_CURRENT_TEST") is not None
    )


def _is_test_env() -> bool:
    """
    Detect pytest/CI environments where rate limiting should be relaxed.

    We intentionally check multiple signals because CI setups vary:
    - PYTEST_CURRENT_TEST is set during pytest runs
    - ENVIRONMENT can be "test" or "ci"
    - DISABLE_RATE_LIMIT can be set explicitly
    """
    if os.getenv("DISABLE_RATE_LIMIT", "").lower() in {"1", "true", "yes", "on"}:
        return True
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True
    if os.getenv("ENVIRONMENT", "").lower() in {"test", "ci"}:
        return True
    return False


IS_TEST_ENV = _is_test_env()

# Configuration from environment with safe defaults
# Global rate limit (applies to all endpoints unless overridden)
GLOBAL_RATE_LIMIT = os.getenv("RATE_LIMIT_GLOBAL", "60/minute")

# Stricter limit for auth-sensitive endpoints
AUTH_RATE_LIMIT = os.getenv("RATE_LIMIT_AUTH", "10/minute")

# Webhook endpoints (public but should be limited)
WEBHOOK_RATE_LIMIT = os.getenv("RATE_LIMIT_WEBHOOK", "30/minute")

# If running tests/CI, relax limits to avoid 429s during fast test bursts
if IS_TEST_ENV:
    GLOBAL_RATE_LIMIT = os.getenv("RATE_LIMIT_GLOBAL_TEST", "100000/minute")
    AUTH_RATE_LIMIT = os.getenv("RATE_LIMIT_AUTH_TEST", "100000/minute")
    WEBHOOK_RATE_LIMIT = os.getenv("RATE_LIMIT_WEBHOOK_TEST", "100000/minute")

# Create the limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[GLOBAL_RATE_LIMIT],
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI", "memory://"),
    strategy="fixed-window",
)
