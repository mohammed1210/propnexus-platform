from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from backend.services.enrichment_service import compute_and_store_enrichment
from backend.utils.enrichment_store import get_property_enrichment_cache, is_fresh
from backend.utils.sentry_init import capture_exception
from backend.utils.supabase_client import get_supabase

router = APIRouter(prefix="/enrich", tags=["enrich"])


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/{property_id}")
async def enrich_property(
    property_id: str,
    force: bool = Query(default=False, description="Ignore cache and recompute"),
) -> Dict[str, Any]:
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    ttl_hours = int(os.getenv("ENRICH_TTL_HOURS", "24"))

    # Cache hit
    try:
        cached = get_property_enrichment_cache(sb, property_id)
        if (
            cached
            and not force
            and is_fresh(fetched_at=cached.get("fetched_at"), ttl_hours=ttl_hours)
        ):
            payload = cached.get("payload") if isinstance(cached.get("payload"), dict) else {}
            return {
                "property_id": property_id,
                "source": "cache",
                "fetched_at": cached.get("fetched_at"),
                "payload": payload,
            }
    except Exception as e:
        capture_exception(e)

    try:
        payload = await compute_and_store_enrichment(
            sb=sb,
            property_id=property_id,
            force=force,
            ttl_hours=ttl_hours,
        )
    except Exception as e:
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Enrichment failed")

    return {
        "property_id": property_id,
        "source": "computed",
        "fetched_at": _utcnow_iso(),
        "payload": payload,
    }
