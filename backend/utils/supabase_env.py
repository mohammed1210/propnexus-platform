from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    key: str


@dataclass(frozen=True)
class SupabaseEnvBlock:
    """Canonical backend Supabase environment block."""

    url: str | None
    service_role_key: str | None

    @property
    def configured(self) -> bool:
        return bool(self.url and self.service_role_key)

    @property
    def missing_vars(self) -> tuple[str, ...]:
        missing: list[str] = []
        if not self.url:
            missing.append("SUPABASE_URL")
        if not self.service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        return tuple(missing)


def _getenv_stripped(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def resolve_supabase_env_block() -> SupabaseEnvBlock:
    """Read the canonical backend Supabase env block.

    Required vars:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    """

    return SupabaseEnvBlock(
        url=_getenv_stripped("SUPABASE_URL"),
        service_role_key=_getenv_stripped("SUPABASE_SERVICE_ROLE_KEY"),
    )


def resolve_supabase_config() -> SupabaseConfig | None:
    env_block = resolve_supabase_env_block()
    if not env_block.configured:
        return None
    return SupabaseConfig(url=env_block.url or "", key=env_block.service_role_key or "")


def is_supabase_configured() -> bool:
    return resolve_supabase_config() is not None
