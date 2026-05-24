from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import HTTPException, Request

INTERNAL_API_TOKEN_HEADER = "X-PropNexus-Internal-Token"


def _configured_internal_token() -> str:
    return (os.getenv("PROPNEXUS_INTERNAL_API_TOKEN") or "").strip()


def require_internal_api_token(
    request: Request,
    provided_token: Optional[str] = None,
) -> None:
    """Require the shared server-side token used by trusted Next.js API proxies."""
    expected = _configured_internal_token()
    supplied = (provided_token or request.headers.get(INTERNAL_API_TOKEN_HEADER) or "").strip()

    if not expected:
        raise HTTPException(status_code=503, detail="Internal API authentication is not configured")

    if not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
