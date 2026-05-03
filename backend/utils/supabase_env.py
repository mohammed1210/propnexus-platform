from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

SERVICE_ROLE_KEY_ENV_ORDER: tuple[str, ...] = (
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_KEY",
)

SUPABASE_URL_ENV_ORDER: tuple[str, ...] = (
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_URL",
)


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

    # Deployment dashboards sometimes receive values copied directly from a
    # shell/.env file, including quotes or an accidental `NAME=` / `export NAME=`
    # prefix. Normalize those harmless wrappers before passing values to SDKs.
    for _ in range(2):
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1].strip()

        export_prefix = f"export {name}="
        assignment_prefix = f"{name}="
        if value.startswith(export_prefix):
            value = value[len(export_prefix) :].strip()
        elif value.startswith(assignment_prefix):
            value = value[len(assignment_prefix) :].strip()

    return value or None


def _normalize_supabase_url(value: str | None) -> str | None:
    url = (value or "").strip()
    if not url:
        return None

    parsed = urlparse(url)
    if not parsed.scheme and "://" not in url:
        # Be forgiving for env values copied without a scheme. Supabase SDKs
        # require an absolute http(s) URL, and Supabase project refs are HTTPS.
        url = f"https://{url}"

    return url.rstrip("/") or None


def _looks_like_placeholder_url(value: str | None) -> bool:
    url = (value or "").strip().lower()
    return bool(
        not url
        or "<supabase-url>" in url
        or "your-project.supabase.co" in url
        or "project-ref.supabase.co" in url
    )


def _get_first_non_empty(names: tuple[str, ...]) -> str | None:
    for name in names:
        value = _getenv_stripped(name)
        if value:
            return value
    return None


def _get_first_non_placeholder_url(names: tuple[str, ...]) -> str | None:
    for name in names:
        value = _normalize_supabase_url(_getenv_stripped(name))
        if value and not _looks_like_placeholder_url(value):
            return value
    return None


def resolve_supabase_env_block() -> SupabaseEnvBlock:
    """Read the canonical backend Supabase env block.

    Required vars:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY (preferred; legacy aliases are accepted)
    """

    return SupabaseEnvBlock(
        url=_get_first_non_placeholder_url(SUPABASE_URL_ENV_ORDER),
        service_role_key=_get_first_non_empty(SERVICE_ROLE_KEY_ENV_ORDER),
    )


def resolve_supabase_config() -> SupabaseConfig | None:
    env_block = resolve_supabase_env_block()
    if not env_block.configured:
        return None
    return SupabaseConfig(url=env_block.url or "", key=env_block.service_role_key or "")


def is_supabase_configured() -> bool:
    return resolve_supabase_config() is not None
