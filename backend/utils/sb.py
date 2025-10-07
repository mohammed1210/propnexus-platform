from __future__ import annotations

import os

from fastapi import HTTPException, status

from supabase import Client, create_client

_SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
_SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE")
)

_sb: Client | None = None
if _SUPABASE_URL and _SUPABASE_KEY:
    _sb = create_client(_SUPABASE_URL, _SUPABASE_KEY)


def require_sb() -> Client:
    """Return Supabase client or 503 (keeps the app healthy)."""
    if _sb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured on server",
        )
    return _sb
