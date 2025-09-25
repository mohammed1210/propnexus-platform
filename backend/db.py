# backend/db.py
import logging
import os
from typing import Optional

from supabase import Client, ClientOptions, create_client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")


def make_supabase() -> Optional[Client]:
    """
    Create a Supabase client (SDK v2).
    Note: supabase-py doesn't expose a way to inject a custom httpx client.
    We keep conservative timeouts to avoid hanging requests.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase not configured: missing SUPABASE_URL or SUPABASE_KEY")
        return None
    try:
        options = ClientOptions(
            postgrest_client_timeout=10,
            storage_client_timeout=10,
            realtime_client_timeout=10,
        )
        client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        logger.info("Supabase client created")
        return client
    except Exception:
        logger.exception("Failed to create Supabase client")
        return None


# Singleton used by routes
sb: Optional[Client] = make_supabase()
