from __future__ import annotations

import os

from fastapi import HTTPException, Request, status


def _is_debug_enabled() -> bool:
    """
    Debug endpoints are allowed when:
    - ENVIRONMENT/NODE_ENV is NOT production, OR
    - ENABLE_DEBUG_ENDPOINTS is set true-ish
    """

    env = (os.getenv("ENVIRONMENT") or os.getenv("NODE_ENV") or "").lower()
    if env in {"prod", "production"}:
        return os.getenv("ENABLE_DEBUG_ENDPOINTS", "").lower() in {"1", "true", "yes", "on"}
    return True


async def require_debug_enabled(_: Request) -> None:
    # Hide debug endpoints in production unless explicitly enabled.
    if not _is_debug_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
