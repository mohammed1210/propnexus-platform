from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from backend.utils.enrichment import build_property_enrichment
from backend.utils.enrichment_store import (
    get_postcode_geo_cache,
    get_property_enrichment_cache,
    is_fresh,
    upsert_postcode_geo_cache,
    upsert_property_enrichment_cache,
)
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

    # Load base property row
    try:
        res = (
            sb.table("properties")
            .select("*")
            .eq("id", property_id)
            .limit(1)
            .maybe_single()
            .execute()
        )
        row = res.data if isinstance(res.data, dict) else None
    except Exception as e:
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Failed to fetch property")

    if not row:
        raise HTTPException(status_code=404, detail="Property not found")

    # Compute enrichment
    try:
        payload = await build_property_enrichment(sb=sb, property_row=row)
    except Exception as e:
        capture_exception(e)
        raise HTTPException(status_code=500, detail="Enrichment failed")

    fetched_at_iso = _utcnow_iso()

    # Store property-level enrichment
    try:
        upsert_property_enrichment_cache(
            sb,
            property_id=property_id,
            postcode=(row.get("postcode") if isinstance(row, dict) else None),
            payload=payload,
            fetched_at_iso=fetched_at_iso,
        )
    except Exception as e:
        capture_exception(e)

    # Store postcode geo cache (best-effort)
    try:
        geo = payload.get("geo") if isinstance(payload, dict) else None
        if isinstance(geo, dict):
            postcode = geo.get("postcode")
            lat = geo.get("latitude")
            lng = geo.get("longitude")
            source = geo.get("source")
            raw = geo.get("raw")

            if (
                isinstance(postcode, str)
                and postcode.strip()
                and lat is not None
                and lng is not None
            ):
                existing = get_postcode_geo_cache(sb, postcode)
                if (
                    not existing
                    or force
                    or not is_fresh(
                        fetched_at=(
                            existing.get("fetched_at") if isinstance(existing, dict) else None
                        ),
                        ttl_hours=ttl_hours,
                    )
                ):
                    upsert_postcode_geo_cache(
                        sb,
                        postcode=postcode,
                        latitude=float(lat) if lat is not None else None,
                        longitude=float(lng) if lng is not None else None,
                        source=str(source or "unknown"),
                        raw=raw,
                        fetched_at_iso=fetched_at_iso,
                    )
    except Exception as e:
        capture_exception(e)

    return {
        "property_id": property_id,
        "source": "computed",
        "fetched_at": fetched_at_iso,
        "payload": payload,
    }
