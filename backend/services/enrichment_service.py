from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from backend.utils.deal_scoring import compute_deal_score
from backend.utils.enrichment import build_property_enrichment
from backend.utils.enrichment_store import (
    get_postcode_geo_cache,
    is_fresh,
    upsert_postcode_geo_cache,
    upsert_property_enrichment_cache,
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_zero_coord(lat: Any, lng: Any) -> bool:
    try:
        if lat is None or lng is None:
            return False
        return float(lat) == 0.0 and float(lng) == 0.0
    except Exception:
        return False


def _coord_missing(lat: Any, lng: Any) -> bool:
    return lat is None or lng is None or _is_zero_coord(lat, lng)


def _should_override_metric(existing: Any, *, is_proxy: bool) -> bool:
    if existing is None:
        return True
    try:
        if float(existing) == 0.0:
            return True
    except Exception:
        return True
    return bool(is_proxy)


def _maybe_update_property_from_enrichment(
    *,
    sb: Any,
    property_row: Dict[str, Any],
    payload: Dict[str, Any],
) -> bool:
    """Persist enrichment-derived fields back onto the properties row.

    Only writes when current values are missing/placeholder/proxy.
    Returns True if any fields were updated.
    """

    if not isinstance(property_row, dict) or not isinstance(payload, dict):
        return False

    pid = property_row.get("id")
    if not pid:
        return False

    geo = payload.get("geo") if isinstance(payload.get("geo"), dict) else {}
    derived = payload.get("derived") if isinstance(payload.get("derived"), dict) else {}

    updated: Dict[str, Any] = {}

    # --- Geo (lat/lng) ---
    cur_lat = property_row.get("latitude")
    cur_lng = property_row.get("longitude")
    en_lat = geo.get("latitude")
    en_lng = geo.get("longitude")

    if _coord_missing(cur_lat, cur_lng) and not _coord_missing(en_lat, en_lng):
        try:
            updated["latitude"] = float(en_lat)
            updated["longitude"] = float(en_lng)
        except Exception:
            pass

    # --- Metrics (rent/yield/roi) ---
    roi_is_proxy = bool(property_row.get("roi_is_proxy"))
    rent_source = (property_row.get("rent_source") or "").lower()
    rent_is_proxy = rent_source == "proxy"

    d_rent = derived.get("rent_estimate_monthly")
    if d_rent is None:
        d_rent = derived.get("rent_monthly")
    d_yield = derived.get("yield_percent")
    d_roi = derived.get("roi_percent")

    if d_rent is not None and _should_override_metric(
        property_row.get("rent_monthly"), is_proxy=rent_is_proxy
    ):
        try:
            updated["rent_monthly"] = float(d_rent)
            updated["rent_source"] = derived.get("rent_source") or "enriched"
        except Exception:
            pass

    if d_yield is not None and _should_override_metric(
        property_row.get("yield_percent"), is_proxy=False
    ):
        try:
            updated["yield_percent"] = float(d_yield)
        except Exception:
            pass

    if d_roi is not None and _should_override_metric(
        property_row.get("roi_percent"), is_proxy=roi_is_proxy
    ):
        try:
            updated["roi_percent"] = float(d_roi)
            updated["roi_is_proxy"] = False
        except Exception:
            pass

    if not updated:
        return False

    # Recompute score+breakdown based on the updated row.
    try:
        scoring_row = {**property_row, **updated}
        score, breakdown = compute_deal_score(scoring_row)
        updated["score"] = score
        updated["score_breakdown"] = breakdown
        updated["score_updated_at"] = _utcnow_iso()
    except Exception:
        # Never fail enrichment due to scoring issues.
        pass

    try:
        sb.table("properties").update(updated).eq("id", str(pid)).execute()
        return True
    except Exception:
        # Never fail enrichment due to persistence issues.
        return False


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

    # If enrichment produced improved geo/metrics, persist them to `properties`
    # and refresh score + score_breakdown (used by ROI Potential UI).
    try:
        if isinstance(row, dict) and isinstance(payload, dict):
            _maybe_update_property_from_enrichment(sb=sb, property_row=row, payload=payload)
    except Exception:
        pass

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
