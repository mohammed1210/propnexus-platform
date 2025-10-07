# backend/db.py
from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv

from supabase import Client, create_client

load_dotenv()

# Lazily created singleton
_SUPABASE: Optional[Client] = None


def make_supabase() -> Optional[Client]:
    """
    Create a Supabase client if env vars are present.
    We avoid passing custom ClientOptions to stay compatible with the
    supabase-py version installed in Railway.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

    if not url or not key:
        # Missing credentials — callers should handle None
        return None

    try:
        return create_client(url, key)
    except Exception:
        # If the library version or env are off, don't crash the app;
        # routers can choose to 404/503 gracefully.
        return None


def get_supabase() -> Optional[Client]:
    global _SUPABASE
    if _SUPABASE is None:
        _SUPABASE = make_supabase()
    return _SUPABASE
