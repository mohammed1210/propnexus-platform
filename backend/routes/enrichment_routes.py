from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from backend.services.enrichment_service import compute_and_store_enrichment
from backend.utils.enrichment_store import get_property_enrichment_cache, is_fresh
from backend.utils.sentry_init import capture_exception
from backend.utils.supabase_client import get_supabase

router = APIRouter(prefix="/enrich", tags=["enrich"])

logger = logging.getLogger(__name__)


def _is_zero_coord(lat: Any, lng: Any) -> bool:
    try:
        if lat is None or lng is None:
            return False
        return float(lat) == 0.0 and float(lng) == 0.0
    except Exception:
        return False


def _geo_missing(lat: Any, lng: Any) -> bool:
    return lat is None or lng is None or _is_zero_coord(lat, lng)


def _log_geo_issue(*, property_id: str, payload: Dict[str, Any], source: str) -> None:
    try:
        geo = payload.get("geo") if isinstance(payload, dict) else None
        if not isinstance(geo, dict):
            return

        postcode = (geo.get("postcode") or "").strip()
        lat = geo.get("latitude")
        lng = geo.get("longitude")

        # Only log when we had a postcode but still couldn't get usable coords.
        if not postcode:
            return

        if not _geo_missing(lat, lng):
            return

        raw = geo.get("raw")
        raw_preview: Dict[str, Any] | None = None
        if isinstance(raw, dict):
            raw_preview = {
                k: raw.get(k)
                for k in (
                    "status_code",
                    "error",
                    "message",
                    "postcode",
                    "body",
                )
                if k in raw
            }
            body = raw_preview.get("body") if isinstance(raw_preview.get("body"), str) else None
            if body:
                raw_preview["body"] = body[:300]

        logger.warning(
            "enrich_geo_missing property_id=%s source=%s geo_source=%s postcode=%s lat=%s lng=%s raw=%s",
            property_id,
            source,
            geo.get("source"),
            postcode,
            lat,
            lng,
            raw_preview,
        )
    except Exception:
        return


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
            _log_geo_issue(property_id=property_id, payload=payload, source="cache")
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

    if isinstance(payload, dict):
        _log_geo_issue(property_id=property_id, payload=payload, source="computed")

    return {
        "property_id": property_id,
        "source": "computed",
        "fetched_at": _utcnow_iso(),
        "payload": payload,
    }
