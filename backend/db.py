from __future__ import annotations

import os
from typing import Optional

try:
    from supabase import Client, create_client  # type: ignore
except Exception:
    Client = object  # type: ignore

    def create_client(*_a: object, **_kw: object) -> object:  # type: ignore
        raise RuntimeError("Supabase SDK not available")


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLIC_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

sb: Optional[Client] = None
if SUPABASE_URL and (SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY):
    key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    try:
        sb = create_client(SUPABASE_URL, key)  # type: ignore
    except Exception:
        sb = None
else:
    sb = None

__all__ = ["sb"]
