from __future__ import annotations

import os

from dotenv import load_dotenv

from supabase import Client, create_client  # type: ignore

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL / SUPABASE_*_KEY env vars")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
