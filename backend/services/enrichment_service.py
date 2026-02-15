from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from backend.utils.enrichment import build_property_enrichment
from backend.utils.enrichment_store import (
    get_postcode_geo_cache,
    is_fresh,
    upsert_postcode_geo_cache,
    upsert_property_enrichment_cache,
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def compute_and_store_enrichment(
    *,
    sb: Any,
    property_id: str,
    force: bool = False,
    ttl_hours: int = 24,
) -> Dict[str, Any]:
    pid = (property_id or "").strip()
    if not pid:
        raise ValueError("property_id required")

    res = sb.table("properties").select("*").eq("id", pid).limit(1).maybe_single().execute()
    row = res.data if isinstance(res.data, dict) else None
    if not row:
        raise LookupError("Property not found")

    payload = await build_property_enrichment(sb=sb, property_row=row)
    fetched_at_iso = _utcnow_iso()

    upsert_property_enrichment_cache(
        sb,
        property_id=pid,
        postcode=row.get("postcode") if isinstance(row, dict) else None,
        payload=payload,
        fetched_at_iso=fetched_at_iso,
    )

    # Postcode geo cache best-effort
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
                    force
                    or not existing
                    or not is_fresh(
                        fetched_at=(existing or {}).get("fetched_at"), ttl_hours=ttl_hours
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
    except Exception:
        pass

    return payload
