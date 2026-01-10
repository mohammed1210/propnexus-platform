# backend/middleware/security.py
"""
Security middleware for FastAPI application.
Adds security headers and other production-ready security features.
"""
from __future__ import annotations

import os
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all responses.
    Configurable via environment variables with safe defaults.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # X-Content-Type-Options: prevents MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options: prevents clickjacking
        frame_options = os.getenv("SECURITY_FRAME_OPTIONS", "DENY")
        response.headers["X-Frame-Options"] = frame_options

        # Referrer-Policy: controls referrer information
        referrer_policy = os.getenv(
            "SECURITY_REFERRER_POLICY", "strict-origin-when-cross-origin"
        )
        response.headers["Referrer-Policy"] = referrer_policy

        # Content-Security-Policy: light CSP for API (can be tightened)
        csp = os.getenv(
            "SECURITY_CSP",
            "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
        )
        if csp:
            response.headers["Content-Security-Policy"] = csp

        # X-XSS-Protection: legacy header but harmless to include
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Remove X-Powered-By if present (Starlette headers don't support .pop())
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]

        return response
