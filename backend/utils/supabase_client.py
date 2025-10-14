from __future__ import annotations
import os
from typing import Optional

def get_supabase():
    """
    Return a Supabase client if env is present, else None.
    Avoids hard dependency locally and in CI without secrets.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None
