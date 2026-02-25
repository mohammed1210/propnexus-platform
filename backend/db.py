from __future__ import annotations

import os

from backend.utils.supabase_client import get_supabase

# Connection pooling configuration (configurable via env)
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Backwards-compatible export used in older modules.
sb = get_supabase(required=False)

__all__ = ["sb", "DB_POOL_MAX", "DB_POOL_TIMEOUT"]
