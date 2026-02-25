from __future__ import annotations

from fastapi import HTTPException, status

from backend.utils.supabase_client import get_supabase
from supabase import Client

_sb: Client | None = get_supabase(required=False)


def require_sb() -> Client:
    """Return Supabase client or 503 (keeps the app healthy)."""
    if _sb is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured on server",
        )
    return _sb
