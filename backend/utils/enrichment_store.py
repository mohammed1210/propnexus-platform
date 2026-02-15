from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from postgrest.exceptions import APIError


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(ts: Any) -> datetime | None:
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts.astimezone(timezone.utc)
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            return None
    return None


def is_fresh(*, fetched_at: Any, ttl_hours: int) -> bool:
    dt = _parse_ts(fetched_at)
    if not dt:
        return False
    return (_utcnow() - dt) < timedelta(hours=max(1, int(ttl_hours or 0)))


def get_postcode_geo_cache(sb: Any, postcode: str) -> Optional[Dict[str, Any]]:
    pc = (postcode or "").strip().upper()
    if not pc:
        return None
    try:
        res = (
            sb.table("postcode_geo_cache")
            .select("*")
            .eq("postcode", pc)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return res.data if isinstance(res.data, dict) else None
    except Exception:
        return None


def upsert_postcode_geo_cache(
    sb: Any,
    *,
    postcode: str,
    latitude: float | None,
    longitude: float | None,
    source: str,
    raw: Any,
    fetched_at_iso: str,
) -> None:
    pc = (postcode or "").strip().upper()
    if not pc:
        return
    payload = {
        "postcode": pc,
        "latitude": latitude,
        "longitude": longitude,
        "source": (source or "").strip() or "unknown",
        "raw": raw,
        "fetched_at": fetched_at_iso,
    }
    try:
        sb.table("postcode_geo_cache").upsert(payload).execute()
    except Exception:
        # Non-fatal: treat cache writes as best-effort.
        return


def get_property_enrichment_cache(sb: Any, property_id: str) -> Optional[Dict[str, Any]]:
    pid = (property_id or "").strip()
    if not pid:
        return None
    try:
        res = (
            sb.table("property_enrichment_cache")
            .select("*")
            .eq("property_id", pid)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return res.data if isinstance(res.data, dict) else None
    except Exception:
        return None


def upsert_property_enrichment_cache(
    sb: Any,
    *,
    property_id: str,
    postcode: str | None,
    payload: Dict[str, Any],
    fetched_at_iso: str,
) -> None:
    pid = (property_id or "").strip()
    if not pid:
        return
    pc = (postcode or "").strip().upper() or None
    row = {
        "property_id": pid,
        "postcode": pc,
        "payload": payload,
        "fetched_at": fetched_at_iso,
    }
    try:
        sb.table("property_enrichment_cache").upsert(row).execute()
    except Exception:
        return


def safe_select_ppd_sales(
    sb: Any,
    *,
    postcode_prefix: str,
    limit: int = 20,
    months_back: int = 24,
) -> list[dict[str, Any]]:
    """Best-effort PPD query.

    Returns [] if the table doesn't exist or query fails.
    """

    prefix = (postcode_prefix or "").strip().upper()
    if not prefix:
        return []

    # We intentionally avoid complex geospatial filtering here.
    # v1: match postcode prefix (e.g. outward code) and recent transfers.
    try:
        q = (
            sb.table("ppd_sales")
            .select(
                "price,date_of_transfer,postcode,property_type,new_build,tenure,paon,saon,street,town_city,district,county,latitude,longitude"
            )
            .ilike("postcode", f"{prefix}%")
            .order("date_of_transfer", desc=True)
            .limit(max(1, min(int(limit or 0), 100)))
        )

        # If date filtering fails for any reason, we still return limited rows.
        try:
            cutoff = (_utcnow().date() - timedelta(days=int(months_back or 0) * 31)).isoformat()
            q = q.gte("date_of_transfer", cutoff)
        except Exception:
            pass

        res = q.execute()
        rows = res.data or []
        return rows if isinstance(rows, list) else []
    except APIError:
        return []
    except Exception:
        return []
