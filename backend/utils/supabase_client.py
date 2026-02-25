from __future__ import annotations

import os
from collections.abc import Callable

from backend.utils.supabase_env import resolve_supabase_config


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
        if create_client_fn is None:
            from supabase import create_client

            return create_client(cfg.url, cfg.key)
        return create_client_fn(cfg.url, cfg.key)
    except Exception:
        if required:
            raise
        return None
