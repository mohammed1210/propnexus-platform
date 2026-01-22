# backend/middleware/error_handler.py
"""
Centralized error handling middleware for consistent error responses.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Catches unhandled exceptions and returns consistent JSON error responses.
    Does not expose stack traces in production mode.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        try:
            response = await call_next(request)
            return response
        except HTTPException:
            raise
        except Exception as exc:
            # Log the full error for debugging
            logger.exception("Unhandled exception during request processing")

            # Determine if we're in production mode
            is_production = os.getenv("ENVIRONMENT", "development").lower() in [
                "production",
                "prod",
            ]

            # Build error response
            error_data: dict[str, Any] = {
                "error": {
                    "message": "An internal error occurred",
                    "code": "INTERNAL_ERROR",
                }
            }

            # In non-production, include exception details
            if not is_production:
                error_data["error"]["detail"] = str(exc)
                error_data["error"]["type"] = type(exc).__name__

            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_data,
            )
