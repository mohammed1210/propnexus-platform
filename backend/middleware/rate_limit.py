# backend/middleware/rate_limit.py
"""
Rate limiting configuration using slowapi.
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Configuration from environment with safe defaults
# Global rate limit (applies to all endpoints unless overridden)
GLOBAL_RATE_LIMIT = os.getenv("RATE_LIMIT_GLOBAL", "60/minute")

# Stricter limit for auth-sensitive endpoints
AUTH_RATE_LIMIT = os.getenv("RATE_LIMIT_AUTH", "10/minute")

# Webhook endpoints (public but should be limited)
WEBHOOK_RATE_LIMIT = os.getenv("RATE_LIMIT_WEBHOOK", "30/minute")

# Create the limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[GLOBAL_RATE_LIMIT],
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI", "memory://"),
    strategy="fixed-window",
)
