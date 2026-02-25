from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    key: str


def _getenv_stripped(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def resolve_supabase_url() -> str | None:
    """Resolve Supabase URL.

    Primary source is `SUPABASE_URL`. We also accept `NEXT_PUBLIC_SUPABASE_URL`
    as a backwards-compatible fallback used by some deployments.
    """

    return _getenv_stripped("SUPABASE_URL") or _getenv_stripped("NEXT_PUBLIC_SUPABASE_URL")


def resolve_supabase_key() -> str | None:
    """Resolve Supabase API key with canonical precedence.

    Precedence:
    1) SUPABASE_SERVICE_ROLE_KEY
    2) SUPABASE_SERVICE_KEY
    3) SUPABASE_KEY
    """

    return (
        _getenv_stripped("SUPABASE_SERVICE_ROLE_KEY")
        or _getenv_stripped("SUPABASE_SERVICE_KEY")
        or _getenv_stripped("SUPABASE_KEY")
    )


def resolve_supabase_config() -> SupabaseConfig | None:
    url = resolve_supabase_url()
    key = resolve_supabase_key()
    if not url or not key:
        return None
    return SupabaseConfig(url=url, key=key)


def is_supabase_configured() -> bool:
    return resolve_supabase_config() is not None
