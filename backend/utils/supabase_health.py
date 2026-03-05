from __future__ import annotations

from dataclasses import dataclass

from backend.utils.supabase_client import get_supabase
from backend.utils.supabase_env import resolve_supabase_env_block


@dataclass(frozen=True)
class SupabaseProbeResult:
    configured: bool
    required_vars: tuple[str, str]
    missing_vars: tuple[str, ...]
    db_reachable: bool
    detail: str


def probe_supabase() -> SupabaseProbeResult:
    """Probe canonical Supabase configuration and basic DB reachability."""

    env_block = resolve_supabase_env_block()
    required_vars = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")

    if not env_block.configured:
        return SupabaseProbeResult(
            configured=False,
            required_vars=required_vars,
            missing_vars=env_block.missing_vars,
            db_reachable=False,
            detail="Missing required Supabase environment variables.",
        )

    client = get_supabase(required=False)
    if client is None:
        return SupabaseProbeResult(
            configured=True,
            required_vars=required_vars,
            missing_vars=(),
            db_reachable=False,
            detail="Supabase client could not be initialized.",
        )

    try:
        # Minimal DB round-trip against a core table used by the backend.
        client.table("properties").select("id").limit(1).execute()
        return SupabaseProbeResult(
            configured=True,
            required_vars=required_vars,
            missing_vars=(),
            db_reachable=True,
            detail="Supabase configured and reachable.",
        )
    except Exception:
        return SupabaseProbeResult(
            configured=True,
            required_vars=required_vars,
            missing_vars=(),
            db_reachable=False,
            detail="Supabase query failed.",
        )

