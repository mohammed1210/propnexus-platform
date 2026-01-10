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

# Connection pooling configuration (configurable via env)
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

sb: Optional[Client] = None
if SUPABASE_URL and (SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY):
    key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    try:
        # Note: Supabase Python client manages its own connection pool internally.
        # The postgrest and httpx clients have reasonable defaults.
        # We document the env vars for future tuning if needed.
        sb = create_client(SUPABASE_URL, key)  # type: ignore
    except Exception:
        sb = None
else:
    sb = None

__all__ = ["sb", "DB_POOL_MAX", "DB_POOL_TIMEOUT"]
