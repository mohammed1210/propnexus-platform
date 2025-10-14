from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from main import sb  # Supabase client provided by backend/main.py
from backend.services.providers import get_comps_from_provider

router = APIRouter(prefix="/comps", tags=["comps"])

TTL_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_fresh(ts_iso: Optional[str], ttl_h: int) -> bool:
    if not ts_iso:
        return False
    try:
        ts = datetime.fromisoformat(ts_iso.replace("Z", "+00:00"))
    except Exception:
        return False
    return (_utcnow() - ts) < timedelta(hours=ttl_h)


def _select_latest_comps(pc: str) -> Optional[Dict[str, Any]]:
    # Expect schema: (postcode TEXT PK, payload JSONB, fetched_at TIMESTAMP)
    res = (
        sb.table("comps_cache")
        .select("*")
        .eq("postcode", pc)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    return data[0] if data else None


def _upsert_comps(pc: str, payload: Dict[str, Any]) -> None:
    now = _utcnow().isoformat()
    sb.table("comps_cache").upsert(
        {"postcode": pc, "payload": payload, "fetched_at": now}
    ).execute()


@router.get("/{postcode}")
def get_comps(postcode: str, request: Request) -> Dict[str, Any]:
    pc = (postcode or "").strip().upper()
    if not pc:
        raise HTTPException(status_code=400, detail="postcode required")

    # 1) cache check
    hit = _select_latest_comps(pc)
    if hit and _is_fresh(hit.get("fetched_at"), TTL_HOURS):
        return {"source": "cache", **(hit.get("payload") or {})}

    # 2) provider fetch (stub)
    try:
        data = get_comps_from_provider(pc)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")

    # 3) upsert and return
    try:
        _upsert_comps(pc, data)
    except Exception:
        # Non-fatal: still return provider data if cache write fails
        pass

    return {"source": "provider", **data}
