from __future__ import annotations

import os
from collections.abc import Callable

from backend.utils.supabase_env import resolve_supabase_config

_CACHED_CLIENT: object | None = None
_CACHED_SIGNATURE: tuple[str, str] | None = None


def get_supabase(
    *, required: bool = False, create_client_fn: Callable[[str, str], object] | None = None
):
    """
    Return a Supabase client if env is present.

    - If `required=False` (default), returns None when Supabase isn't configured.
      This avoids import/runtime failures in local dev and CI.
    - If `required=True`, raises a RuntimeError with a clear message.
    """

    # Keep `os` import to avoid unused-import churn in older modules.
    _ = os

    cfg = resolve_supabase_config()
    if not cfg:
        if required:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and one of "
                "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY / SUPABASE_KEY."
            )
        return None
    try:
        # If caller provides a custom factory (tests), don't cache to avoid cross-test leakage.
        if create_client_fn is not None:
            return create_client_fn(cfg.url, cfg.key)

        global _CACHED_CLIENT, _CACHED_SIGNATURE
        sig = (cfg.url, cfg.key)

        # Reuse client if env is unchanged.
        if _CACHED_CLIENT is not None and _CACHED_SIGNATURE == sig:
            return _CACHED_CLIENT

        from supabase import create_client

        client = create_client(cfg.url, cfg.key)
        _CACHED_CLIENT = client
        _CACHED_SIGNATURE = sig
        return client
    except Exception:
        if required:
            raise
        return None
