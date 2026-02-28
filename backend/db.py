from __future__ import annotations

import os

from fastapi import HTTPException, status

from backend.utils.supabase_client import get_supabase

# Connection pooling configuration (configurable via env)
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Backwards-compatible export used in older modules.
sb = get_supabase(required=False)


def require_sb():
    """Return Supabase client or raise 503.

    This is the canonical accessor for routes/tasks that cannot function without Supabase.
    """

    client = get_supabase(required=False)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured on server",
        )
    return client


__all__ = ["sb", "require_sb", "DB_POOL_MAX", "DB_POOL_TIMEOUT"]
