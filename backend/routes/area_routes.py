from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from main import sb  # Supabase client provided by backend/main.py
from backend.services.providers import get_area_intel_from_provider

router = APIRouter(prefix="/area-intel", tags=["area-intel"])

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


def _select_latest_area(key: str) -> Optional[Dict[str, Any]]:
    # Expect schema: (area_key TEXT PK, payload JSONB, fetched_at TIMESTAMP)
    res = (
        sb.table("area_intel_cache")
        .select("*")
        .eq("area_key", key)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    return data[0] if data else None


def _upsert_area(key: str, payload: Dict[str, Any]) -> None:
    now = _utcnow().isoformat()
    sb.table("area_intel_cache").upsert(
        {"area_key": key, "payload": payload, "fetched_at": now}
    ).execute()


@router.get("/{key}")
def get_area_intel(key: str, request: Request) -> Dict[str, Any]:
    k = (key or "").strip().upper()
    if not k:
        raise HTTPException(status_code=400, detail="key required")

    hit = _select_latest_area(k)
    if hit and _is_fresh(hit.get("fetched_at"), TTL_HOURS):
        return {"source": "cache", **(hit.get("payload") or {})}

    try:
        data = get_area_intel_from_provider(k)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")

    try:
        _upsert_area(k, data)
    except Exception:
        pass

    return {"source": "provider", **data}
