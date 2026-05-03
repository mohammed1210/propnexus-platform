from __future__ import annotations

import os
import socket
from collections.abc import Callable
from urllib.parse import urlparse

from backend.utils.supabase_env import SupabaseConfig, resolve_supabase_config

_CACHED_CLIENT: object | None = None
_CACHED_SIGNATURE: tuple[str, str] | None = None

_PUBLIC_SUPABASE_URL_FALLBACK = "https://wsfemkhxttddztnhthkc.supabase.co"


def _is_production_env() -> bool:
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").strip().lower()
    return env in {"prod", "production"}


def _host_resolves(url: str) -> bool:
    try:
        host = urlparse(url).hostname
        if not host:
            return False
        socket.gethostbyname(host)
        return True
    except Exception:
        return False


def _production_url_fallback() -> str:
    return (
        (
            os.getenv("SUPABASE_URL_FALLBACK")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or _PUBLIC_SUPABASE_URL_FALLBACK
        )
        .strip()
        .rstrip("/")
    )


def _apply_production_url_fallback(cfg: SupabaseConfig) -> SupabaseConfig:
    if not _is_production_env() or _host_resolves(cfg.url):
        return cfg

    fallback_url = _production_url_fallback()
    if fallback_url and fallback_url != cfg.url and _host_resolves(fallback_url):
        return SupabaseConfig(url=fallback_url, key=cfg.key)

    return cfg


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
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
            )
        return None

    cfg = _apply_production_url_fallback(cfg)

    # If caller provides a custom factory (tests), bypass DNS checks and caching.
    if create_client_fn is not None:
        return create_client_fn(cfg.url, cfg.key)

    # If the hostname is not resolvable, treat Supabase as effectively unconfigured.
    # This keeps CI/local dev stable when placeholder env vars are present.
    try:
        if not _host_resolves(cfg.url):
            raise RuntimeError("Invalid or unresolvable SUPABASE_URL")
    except Exception as e:
        if required:
            raise RuntimeError(f"Supabase URL is not resolvable: {cfg.url}") from e
        return None
    try:
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
