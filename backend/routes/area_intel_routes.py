from __future__ import annotations
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request
from backend.utils.supabase_client import get_supabase
from backend.services.providers import get_area_intel_from_provider

router = APIRouter(prefix="/area-intel", tags=["area-intel"])

TTL = timedelta(hours=24)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/{key}")
def get_area_intel(key: str, request: Request):
    """
    GET /area-intel/{key}
    - Return cached payload if fetched_at within 24h
    - Otherwise call provider, upsert into area_intel_cache and return
    """
    sb = get_supabase()
    now = _now_utc()

    if sb:
        try:
            resp = (
                sb.table("area_intel_cache")
                .select("*")
                .eq("area_key", key)
                .order("fetched_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            if rows:
                row = rows[0]
                fetched = datetime.fromisoformat(
                    row["fetched_at"].replace("Z", "+00:00")
                )
                if now - fetched < TTL:
                    return row["payload"]
        except Exception:
            pass

    payload = get_area_intel_from_provider(key)

    if sb:
        try:
            sb.table("area_intel_cache").upsert(
                {
                    "area_key": key,
                    "payload": payload,
                    "fetched_at": now.isoformat(),
                }
            ).execute()
        except Exception:
            pass

    return payload
