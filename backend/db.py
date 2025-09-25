# backend/db.py
from __future__ import annotations

import os
from typing import Optional

import httpx

from supabase import Client, create_client

# Prefer service role (server-side), fall back to anon if needed.
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)


def make_supabase() -> Optional[Client]:
    """
    Create a Supabase client that **forces HTTP/1.1** to avoid Railway edge
    HTTP/2 stream resets. Also sets friendly timeouts.
    """
    if not (SUPABASE_URL and SUPABASE_KEY):
        return None

    http_client = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(connect=5.0, read=10.0, write=10.0, pool=10.0),
    )

    return create_client(SUPABASE_URL, SUPABASE_KEY, http_client=http_client)
