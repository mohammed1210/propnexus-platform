from __future__ import annotations

import asyncio
import builtins
import difflib
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.params import Param
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from backend.config import settings
from backend.search.facets import get_facets
from backend.search.fallback import broaden
from backend.search.query import (
    expand_query_terms,
    fetch_postgres_fuzzy_ids,
    is_postgres_detected,
    query_db,
    search_with_optional_rerank,
)
from backend.utils.admin_auth import require_admin
from backend.utils.canonical_metrics import apply_canonical_metrics
from backend.utils.deal_scoring import compute_deal_score
from backend.utils.deal_signals import extract_deal_signals
from backend.utils.enrichment import build_property_enrichment
from backend.utils.enrichment_store import (
    get_property_enrichment_cache,
    upsert_property_enrichment_cache,
)
from backend.utils.image_utils import dedupe_image_urls, pick_cover_image
from backend.utils.investment_type_classifier import classify_investment_types
from backend.utils.listing_keys import extract_postcode
from backend.utils.property_type_classifier import (
    classify_property_type,
    normalize_property_type_value,
)
from backend.utils.recommended_ranker import normalize_deal_type, rerank_recommended
from backend.utils.supabase_client import get_supabase
from supabase import create_client

router = APIRouter(tags=["properties"])


def _start_enrichment_thread(property_id: str) -> None:
    pid = (property_id or "").strip()
    if not pid:
        return

    def _worker() -> None:
        try:
            sb2 = _get_supabase()
            res = (
                sb2.table("properties").select("*").eq("id", pid).limit(1).maybe_single().execute()
            )
            row = res.data if isinstance(res.data, dict) else None
            if not row:
                return

            payload = asyncio.run(build_property_enrichment(sb=sb2, property_row=row))
            fetched_at_iso = datetime.now(timezone.utc).isoformat()
            upsert_property_enrichment_cache(
                sb2,
                property_id=pid,
                postcode=row.get("postcode") if isinstance(row, dict) else None,
                payload=payload,
                fetched_at_iso=fetched_at_iso,
            )
        except Exception:
            return

    try:
        t = threading.Thread(target=_worker, daemon=True)
        t.start()
    except Exception:
        return


def _attach_cached_enrichment(item: Dict[str, Any], cache_payload: Any) -> None:
    if not isinstance(item, dict) or not isinstance(cache_payload, dict):
        return

    geo = cache_payload.get("geo") if isinstance(cache_payload.get("geo"), dict) else None
    if isinstance(geo, dict):
        if item.get("latitude") in (None, 0, 0.0, "") and geo.get("latitude") is not None:
            item["latitude"] = geo.get("latitude")
        if item.get("longitude") in (None, 0, 0.0, "") and geo.get("longitude") is not None:
            item["longitude"] = geo.get("longitude")

    # Attach nested intel objects if not already present.
    if item.get("area_intel") is None and isinstance(cache_payload.get("area_intel"), dict):
        item["area_intel"] = cache_payload.get("area_intel")
    if item.get("comps") is None and isinstance(cache_payload.get("comps"), dict):
        item["comps"] = cache_payload.get("comps")

    derived = (
        cache_payload.get("derived") if isinstance(cache_payload.get("derived"), dict) else None
    )
    if isinstance(derived, dict):
        if item.get("rent_monthly") is None and derived.get("rent_estimate_monthly") is not None:
            item["rent_monthly"] = derived.get("rent_estimate_monthly")
        if item.get("yield_percent") is None and derived.get("yield_percent") is not None:
            item["yield_percent"] = derived.get("yield_percent")
        if item.get("roi_percent") is None and derived.get("roi_percent") is not None:
            item["roi_percent"] = derived.get("roi_percent")


def _attach_enrichment_from_cache(sb: Any, items: List[Dict[str, Any]]) -> List[str]:
    if not items:
        return []

    missing_ids: List[str] = []

    # Best-effort: per-row lookup (keeps implementation compatible across supabase client versions).
    # If this becomes too slow, we can switch to a batched IN(...) query.
    for it in items:
        pid = it.get("id")
        if not isinstance(pid, str) or not pid.strip():
            continue
        try:
            cached = get_property_enrichment_cache(sb, pid)
            if not cached:
                missing_ids.append(pid)
            payload = cached.get("payload") if isinstance(cached, dict) else None
            _attach_cached_enrichment(it, payload)
        except Exception:
            continue

    return missing_ids


# Allowed sort columns (tests expect invalid -> fallback, not 500)
ALLOWED_SORT_COLS = {
    "created_at",
    "price",
    "bedrooms",
    "bathrooms",
    "yield_percent",
    "roi_percent",
    "ai_score",
    "score",
}


PROPERTIES_NORMALIZATION_VERSION = "v1"


class PropertiesPageResponse(BaseModel):
    items: List[Dict[str, Any]] = Field(default_factory=list)
    # Optional full-result map points (requested via include_points=1).
    # Kept out of default responses to avoid large payloads.
    points: Optional[List[Dict[str, Any]]] = None
    total: int = 0
    mappable_count: int = 0
    limit: int = 50
    offset: int = 0
    has_more: bool = False


class SearchRangeFilter(BaseModel):
    gte: float | None = None
    lte: float | None = None


class SearchFiltersPayload(BaseModel):
    beds: SearchRangeFilter | None = None
    price: SearchRangeFilter | None = None
    yield_filter: SearchRangeFilter | None = Field(default=None, alias="yield")

    model_config = {"populate_by_name": True}


class SearchPayload(BaseModel):
    q: str = ""
    filters: SearchFiltersPayload = Field(default_factory=SearchFiltersPayload)
    session_id: str | None = None
    allow_broaden: bool = True
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


def _log_search_query_metric(payload: dict[str, Any], total_results: int) -> None:
    query_text = str(payload.get("q") or "").strip()
    if not query_text:
        return

    filters = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}
    row = {
        "query": query_text,
        "results_count": int(total_results),
        "filters_json": filters,
        "session_id": str(payload.get("session_id") or "").strip() or None,
    }

    try:
        sb = _get_supabase()
        sb.schema("analytics").table("search_queries").insert(row).execute()
    except Exception:
        try:
            sb = _get_supabase()
            sb.table("search_queries").insert(row).execute()
        except Exception:
            return


@router.get("/api/v1/search")
def api_v1_search(
    query: str = Query(default="", alias="query"),
    k: int = Query(default=20, ge=1, le=100),
    ml: str | None = Query(default=None, description="Set to 1 to force ML rerank canary"),
):
    sb = _get_supabase()

    force_ml = str(ml or "").strip().lower() in {"1", "true", "yes", "on"}
    ml_enabled = bool(settings.SMART_SEARCH_ML_RERANK or force_ml)

    top = search_with_optional_rerank(
        sb,
        query_text=query,
        top_k=k,
        enable_ml=ml_enabled,
    )
    ids = [str(item.get("id")) for item in top if item.get("id") is not None]

    return {
        "query": query,
        "ml_enabled": ml_enabled,
        "count": len(top),
        "ids": ids,
        "items": top,
    }


@router.post("/api/v1/search")
def api_v1_search_with_filters(payload: SearchPayload) -> dict[str, Any]:
    filter_payload = payload.model_dump(by_alias=True)
    queried = query_db(filter_payload)
    items = queried.get("items") if isinstance(queried, dict) else []
    total_results = queried.get("total_results") if isinstance(queried, dict) else 0

    out_items = [dict(item) for item in items] if isinstance(items, list) else []

    if not out_items and payload.allow_broaden:
        original_filters = filter_payload.get("filters", {})
        new_filters, changed = broaden(
            original_filters if isinstance(original_filters, dict) else {}
        )
        widened_payload = dict(filter_payload)
        widened_payload["filters"] = new_filters
        widened_payload["allow_broaden"] = False

        alt_queried = query_db(widened_payload)
        alt_items = alt_queried.get("items") if isinstance(alt_queried, dict) else []
        alt_total = alt_queried.get("total_results") if isinstance(alt_queried, dict) else 0
        alt_out_items = [dict(item) for item in alt_items] if isinstance(alt_items, list) else []
        _log_search_query_metric(filter_payload, int(alt_total or len(alt_out_items)))

        return {
            "results": alt_out_items,
            "total": int(alt_total or len(alt_out_items)),
            "broadened": True,
            "changes": changed,
        }

    facets = get_facets(filter_payload)
    _log_search_query_metric(filter_payload, int(total_results or len(out_items)))

    return {
        "q": payload.q,
        "filters": filter_payload.get("filters", {}),
        "items": out_items,
        "count": len(out_items),
        "total_results": int(total_results or 0),
        "facets": facets,
        "limit": payload.limit,
        "offset": payload.offset,
    }


def _safe_order(query: Any, column: str, *, desc: bool, nulls_last: bool = True) -> Any:
    """Order defensively across supabase/postgrest client versions.

    We prefer explicit nulls-last ordering when supported to prevent
    desc-ordering from surfacing NULLs first.
    """

    if nulls_last:
        # postgrest-py commonly supports `nullsfirst`; set False => NULLS LAST.
        try:
            return query.order(column, desc=desc, nullsfirst=False)
        except TypeError:
            pass

        # Some versions may support `nullslast` instead.
        try:
            return query.order(column, desc=desc, nullslast=True)
        except TypeError:
            pass

    return query.order(column, desc=desc)


def _is_mappable_coordinate_pair(lat: Any, lng: Any) -> bool:
    def _to_float(v: Any) -> float | None:
        if v is None or isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            f = float(v)
        elif isinstance(v, str):
            try:
                f = float(v.strip())
            except Exception:
                return None
        else:
            return None

        if not (f == f):  # NaN
            return None
        return f

    lat_f = _to_float(lat)
    lng_f = _to_float(lng)
    if lat_f is None or lng_f is None:
        return False

    if lat_f < -90 or lat_f > 90:
        return False
    if lng_f < -180 or lng_f > 180:
        return False

    return True


def _get_supabase():
    """
    Lazily create Supabase client so unit tests can patch create_client.

    Uses the canonical env resolution in get_supabase(), but passes through the
    local create_client symbol so tests can patch it.
    """
    try:
        sb = get_supabase(required=True, create_client_fn=create_client)
        if sb is None:
            raise RuntimeError("Supabase client is not configured")
        return sb
    except Exception:
        # Test/CI fallback: allow patched create_client to inject a fake client
        # even when SUPABASE_* env vars are not configured.
        try:
            return create_client("http://localhost", "test-key")
        except Exception:
            raise HTTPException(status_code=503, detail="Supabase not configured on server")


def _normalize_property_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a property row for API responses.

    This is intentionally defensive: production data may contain older rows with
    missing top-level fields, while raw fields are available under `data.raw`.
    We normalize protocol-relative URLs (//...) to https://... for frontend use.
    """

    out = dict(row or {})

    def _norm_url(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if s.startswith("//"):
            return f"https:{s}"
        return s

    def _coerce_int(v: Any) -> int | None:
        if v is None or isinstance(v, bool):
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            return int(v)
        if isinstance(v, str):
            digits = "".join(ch for ch in v if ch.isdigit())
            try:
                return int(digits) if digits else None
            except Exception:
                return None
        return None

    def _coerce_float(v: Any) -> float | None:
        if v is None or isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v.strip())
            except Exception:
                return None
        return None

    data_obj = out.get("data")
    raw_obj: Dict[str, Any] = {}
    if isinstance(data_obj, dict):
        if isinstance(data_obj.get("raw"), dict):
            raw_obj = data_obj.get("raw")  # type: ignore[assignment]
        else:
            raw_obj = data_obj

        # Deal signals may be stored as explicit columns or embedded into `data`.
        if out.get("deal_signals") is None and isinstance(data_obj.get("deal_signals"), list):
            out["deal_signals"] = data_obj.get("deal_signals")
        if out.get("deal_reasons") is None and isinstance(data_obj.get("deal_reasons"), list):
            out["deal_reasons"] = data_obj.get("deal_reasons")
        if out.get("deal_signals_meta") is None and isinstance(
            data_obj.get("deal_signals_meta"), dict
        ):
            out["deal_signals_meta"] = data_obj.get("deal_signals_meta")
        if (
            out.get("discount_estimate_pct") is None
            and data_obj.get("discount_estimate_pct") is not None
        ):
            out["discount_estimate_pct"] = data_obj.get("discount_estimate_pct")

        # Property types may be stored in optional columns or embedded in data.
        if out.get("property_type") in (None, "") and isinstance(
            data_obj.get("property_type"), str
        ):
            out["property_type"] = data_obj.get("property_type")
        if out.get("raw_property_type") in (None, "") and isinstance(
            data_obj.get("raw_property_type"), str
        ):
            out["raw_property_type"] = data_obj.get("raw_property_type")

    def _pick_raw(keys: List[str]) -> Any:
        for k in keys:
            v = raw_obj.get(k)
            if v not in (None, "", [], {}):
                return v
        return None

    # Ensure property_type is always present in API response (canonical, deterministic).
    # - Prefer DB column
    # - Else embedded data
    # - Else classify on the fly (do not write to DB here)
    try:
        if not (isinstance(out.get("property_type"), str) and out.get("property_type").strip()):
            raw_candidate = _pick_raw(
                [
                    "propertyType",
                    "property_type",
                    "propertyTypeLabel",
                    "property_type_label",
                    "propertySubType",
                    "type",
                ]
            )
            raw_s: str | None = raw_candidate.strip() if isinstance(raw_candidate, str) else None
            pt, raw_best = classify_property_type(
                out.get("title"),
                out.get("description"),
                raw_s,
                extra=data_obj if isinstance(data_obj, dict) else None,
            )
            out["property_type"] = pt
            if raw_best and not (
                isinstance(out.get("raw_property_type"), str)
                and out.get("raw_property_type").strip()
            ):
                out["raw_property_type"] = raw_best

            # Keep embedded data consistent for frontend consumers (response-only).
            if isinstance(data_obj, dict):
                data_obj.setdefault("property_type", pt)
                if raw_best:
                    data_obj.setdefault("raw_property_type", raw_best)
                out["data"] = data_obj

        # Avoid returning empty-string raw types.
        if (
            isinstance(out.get("raw_property_type"), str)
            and not out.get("raw_property_type").strip()
        ):
            out.pop("raw_property_type", None)
    except Exception:
        pass

    def _is_junk_image_url(u: Any) -> bool:
        s = (u or "").strip().lower() if isinstance(u, str) else ""
        if not s:
            return True
        if "zoopla_static_agent_logo" in s:
            return True
        if "/_next/static/" in s:
            return True
        if "error-image" in s:
            return True
        # Keep floorplans (useful in gallery), but drop generic site icons.
        if "onthemarket.com/assets/images/" in s:
            return True
        if "map-pill.png" in s:
            return True
        if "agentsmutual.co.uk/agent-products/" in s:
            return True
        if s.endswith(".svg"):
            return True
        return False

    def _filter_junk_image_urls(urls: List[str]) -> List[str]:
        if not urls:
            return []

        out: List[str] = []
        seen: set[str] = set()
        for u in urls:
            if not isinstance(u, str):
                continue
            if _is_junk_image_url(u):
                continue
            if u not in seen:
                seen.add(u)
                out.append(u)
        return out

    # image_urls normalization
    imgs = out.get("image_urls")

    # Supabase can return this column as None, a JSON string, or a native list.
    if imgs is None:
        out["image_urls"] = []
    elif isinstance(imgs, str):
        parsed: Any = None
        try:
            parsed = json.loads(imgs)
        except Exception:
            parsed = None
        if isinstance(parsed, list):
            normalized = [_norm_url(u) for u in parsed if isinstance(u, str) and u.strip()]
            out["image_urls"] = _filter_junk_image_urls(normalized)
        else:
            out["image_urls"] = []
    elif isinstance(imgs, list):
        normalized = [_norm_url(u) for u in imgs if isinstance(u, str) and u.strip()]
        out["image_urls"] = _filter_junk_image_urls(normalized)
    else:
        out["image_urls"] = []

    # Dedupe by normalized URL and basename to reduce duplicates across variants.
    try:
        out["image_urls"] = dedupe_image_urls(out.get("image_urls") or [])
    except Exception:
        pass

    # imageurl fallback (front-end expects this)
    if not out.get("imageurl"):
        out["imageurl"] = _pick_raw(["imageurl", "image_url", "imageUrl"]) or (
            out.get("image_urls")[0]
            if isinstance(out.get("image_urls"), list) and out["image_urls"]
            else None
        )
    out["imageurl"] = _norm_url(out.get("imageurl"))

    # Prefer a canonical cover image (avoid floorplan-only when possible).
    try:
        cover = pick_cover_image(out.get("image_urls") or [])
        if cover and ((not out.get("imageurl")) or _is_junk_image_url(out.get("imageurl"))):
            out["imageurl"] = cover
    except Exception:
        pass

    # If we have filtered image_urls, keep imageurl consistent (without
    # clobbering a valid, non-junk imageurl).
    if isinstance(out.get("image_urls"), list) and out["image_urls"]:
        if (not out.get("imageurl")) or _is_junk_image_url(out.get("imageurl")):
            out["imageurl"] = out["image_urls"][0]

    # Location/address hydration
    if not out.get("location"):
        out["location"] = _pick_raw(["location", "displayAddress", "display_address", "address"])
    if not out.get("address"):
        out["address"] = _pick_raw(["address", "displayAddress", "display_address", "location"])

    # Numeric hydration
    # Price: keep numeric for sorting + UX. Attempt to coerce common string formats.
    cur_price = out.get("price")
    if isinstance(cur_price, str):
        coerced = _coerce_int(cur_price)
        if coerced is not None and coerced > 0:
            out["price"] = coerced

    if out.get("price") in (None, 0, 0.0, "") or not isinstance(out.get("price"), (int, float)):
        raw_price = _pick_raw(["price", "displayPrice", "display_price"])
        price = _coerce_int(raw_price)
        if price is not None and price > 0:
            out["price"] = price

    # Yield/ROI: coerce to float when possible.
    if isinstance(out.get("yield_percent"), str):
        out["yield_percent"] = _coerce_float(out.get("yield_percent"))
    if isinstance(out.get("roi_percent"), str):
        out["roi_percent"] = _coerce_float(out.get("roi_percent"))

    if out.get("bedrooms") in (None, 0, ""):
        beds = _coerce_int(_pick_raw(["bedrooms", "beds", "numBedrooms", "numberOfBedrooms"]))
        if beds is not None and beds > 0:
            out["bedrooms"] = beds

    if out.get("bathrooms") in (None, 0, ""):
        baths = _coerce_int(_pick_raw(["bathrooms", "baths", "numBathrooms", "numberOfBathrooms"]))
        if baths is not None and baths > 0:
            out["bathrooms"] = baths

    if out.get("latitude") in (None, 0, 0.0, ""):
        lat = _coerce_float(_pick_raw(["latitude", "lat"]))
        if lat is not None and lat != 0.0:
            out["latitude"] = lat

    if out.get("longitude") in (None, 0, 0.0, ""):
        lng = _coerce_float(_pick_raw(["longitude", "lng", "lon"]))
        if lng is not None and lng != 0.0:
            out["longitude"] = lng

    # Avoid placeholder coordinates breaking maps. Some older rows stored 0,0.
    # Do not blanket-null real (0, x) or (x, 0) coordinates; only treat 0,0 as a placeholder.
    lat_now = _coerce_float(out.get("latitude"))
    lng_now = _coerce_float(out.get("longitude"))
    if lat_now == 0.0 and lng_now == 0.0:
        out["latitude"] = None
        out["longitude"] = None
    elif lat_now == 0.0 and lng_now is None:
        out["latitude"] = None
    elif lng_now == 0.0 and lat_now is None:
        out["longitude"] = None

    # Ensure deal fields are well-typed for frontend.
    if isinstance(out.get("deal_signals"), str):
        out["deal_signals"] = [s.strip() for s in out["deal_signals"].split(",") if s.strip()]
    if out.get("deal_signals") is not None and not isinstance(out.get("deal_signals"), list):
        out["deal_signals"] = []
    if isinstance(out.get("deal_signals"), list):
        out["deal_signals"] = [
            str(s) for s in out["deal_signals"] if isinstance(s, str) and s.strip()
        ]

    if out.get("deal_reasons") is not None and not isinstance(out.get("deal_reasons"), list):
        out["deal_reasons"] = []
    if isinstance(out.get("deal_reasons"), list):
        out["deal_reasons"] = [
            str(s) for s in out["deal_reasons"] if isinstance(s, str) and s.strip()
        ]

    if out.get("discount_estimate_pct") is not None and not isinstance(
        out.get("discount_estimate_pct"), (int, float)
    ):
        try:
            out["discount_estimate_pct"] = float(out.get("discount_estimate_pct"))
        except Exception:
            out["discount_estimate_pct"] = None

    # Canonical metrics backfill for frontend normalizers.
    # Adds/derives: price, rent_monthly, yield_percent, roi_percent.
    try:
        out = apply_canonical_metrics(out)
    except Exception:
        pass

    # If rent/yield/roi are still missing, try a best-effort proxy via deal scoring.
    # IMPORTANT: never write 0 placeholders; only backfill when proxy is > 0.
    try:
        needs_proxy = any(
            out.get(k) is None for k in ("rent_monthly", "yield_percent", "roi_percent")
        )
        if (
            needs_proxy
            and isinstance(out.get("price"), (int, float))
            and float(out.get("price") or 0) > 0
        ):
            _score, breakdown = compute_deal_score(out)
            inputs = breakdown.get("inputs") if isinstance(breakdown, dict) else None
            if isinstance(inputs, dict):
                rent_v = inputs.get("rent_monthly")
                rent_src = inputs.get("rent_source")
                y_v = inputs.get("yield_percent")
                roi_v = inputs.get("roi_percent")
                roi_src = inputs.get("roi_source")

                if (
                    out.get("rent_monthly") is None
                    and isinstance(rent_v, (int, float))
                    and rent_v > 0
                ):
                    if rent_src in {"provided", "proxy"}:
                        out["rent_monthly"] = round(float(rent_v), 2)

                if out.get("yield_percent") is None and isinstance(y_v, (int, float)) and y_v > 0:
                    out["yield_percent"] = round(float(y_v), 2)

                if out.get("roi_percent") is None and isinstance(roi_v, (int, float)) and roi_v > 0:
                    if roi_src != "missing":
                        out["roi_percent"] = round(float(roi_v), 2)
    except Exception:
        pass

    return out


def _parse_bool(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().lower()
    return s in {"1", "true", "t", "yes", "y", "on"}


def _ensure_deal_fields(item: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(item, dict):
        return item

    # If deal_signals already present (column or normalized from data), trust it.
    if isinstance(item.get("deal_signals"), list):
        if not isinstance(item.get("deal_reasons"), list):
            item["deal_reasons"] = []
        return item

    try:
        extracted = extract_deal_signals(item)
    except Exception:
        extracted = None

    if not isinstance(extracted, dict):
        item.setdefault("deal_signals", [])
        item.setdefault("deal_reasons", [])
        item.setdefault("discount_estimate_pct", None)
        return item

    item["deal_signals"] = (
        extracted.get("signals") if isinstance(extracted.get("signals"), list) else []
    )
    item["deal_reasons"] = (
        extracted.get("reasons") if isinstance(extracted.get("reasons"), list) else []
    )
    if item.get("discount_estimate_pct") is None:
        item["discount_estimate_pct"] = extracted.get("discount_estimate_pct")

    # Embed into data payload (in-memory only) so other code paths can use it.
    data_obj = item.get("data")
    if not isinstance(data_obj, dict):
        data_obj = {} if data_obj in (None, "") else {"raw": data_obj}
    data_obj.setdefault("deal_signals", item.get("deal_signals"))
    data_obj.setdefault("deal_reasons", item.get("deal_reasons"))
    if extracted.get("discount_estimate_pct") is not None:
        data_obj.setdefault("discount_estimate_pct", extracted.get("discount_estimate_pct"))
    if extracted.get("lease_years_remaining") is not None:
        data_obj.setdefault("lease_years_remaining", extracted.get("lease_years_remaining"))
    item["data"] = data_obj
    return item


def _matches_deal_filters(
    deal_signals: Any,
    *,
    deals_only: bool,
    required_signals: List[str],
) -> bool:
    sigs: List[str] = []
    if isinstance(deal_signals, str):
        sigs = [s.strip().lower() for s in deal_signals.split(",") if s.strip()]
    elif isinstance(deal_signals, list):
        sigs = [str(s).strip().lower() for s in deal_signals if isinstance(s, str) and s.strip()]

    sigset = set(sigs)

    # Back-compat aliasing: older rows used cash_buyers.
    if "cash_buyers" in sigset and "cash_buyers_only" not in sigset:
        sigset.add("cash_buyers_only")
    if deals_only and not sigset:
        return False
    for s in required_signals:
        if s not in sigset:
            return False
    return True


@router.get(
    "/properties",
    response_model=PropertiesPageResponse,
    response_model_exclude_none=True,
)
def list_properties(
    response: Response,
    q: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None, description="Filter by listing source"),
    created_after: Optional[str] = Query(
        default=None,
        description="Filter rows with created_at >= this ISO timestamp",
    ),
    min: Optional[int] = Query(
        default=None
    ),  # noqa: A002 (min is fine here; matches existing API usage)
    max: Optional[int] = Query(default=None),  # noqa: A002
    beds: Optional[int] = Query(default=None),
    baths: Optional[int] = Query(default=None),
    types: Optional[str] = Query(default=None, description="Comma-separated investment types"),
    investment_type: Optional[str] = Query(
        default=None,
        description=(
            "Investment type filter (comma-separated). Values like: HMO,BTL,SA,BRR,Flip,Commercial"
        ),
    ),
    property_type: Optional[str] = Query(
        default=None,
        description="Property type filter (comma-separated; future use)",
    ),
    deals_only: bool = Query(
        default=False, description="Only return listings with any deal signal"
    ),
    auction_only: bool = Query(default=False),
    reduced_only: bool = Query(default=False),
    needs_refurb_only: bool = Query(default=False),
    chain_free_only: bool = Query(default=False),
    tenanted_only: bool = Query(default=False),
    cash_buyers_only: bool = Query(default=False),
    short_lease_only: bool = Query(default=False),
    below_market_only: bool = Query(default=False),
    signals: Optional[str] = Query(
        default=None,
        description="Comma-separated deal signals to require (e.g. reduced,auction)",
    ),
    deal_type: str = Query(
        default="balanced",
        description="Persona for recommended ranking: balanced|cashflow|growth (only used with sort=recommended)",
    ),
    sort: str = Query(
        default="created_at_desc",
        description=(
            "Sort order. Preferred values: recommended, created_at_desc, price_asc, price_desc, "
            "yield_desc, roi_desc. Backwards compatible: you may also pass a column "
            "name and use dir=asc|desc."
        ),
    ),
    dir: str = Query(default="desc", description="Legacy sort direction (used with column sort)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    include_points: bool = Query(
        default=False,
        description=(
            "Include non-paginated map points for all matching rows (capped by points_limit). "
            "Use this for map pinning across the full result set, not just the current page."
        ),
    ),
    points_limit: int = Query(default=2000, ge=1, le=10000),
):
    try:
        # When called directly (e.g. unit tests), FastAPI Param defaults like Query(...)
        # are not resolved and will be passed through as objects.
        if isinstance(include_points, Param):
            include_points = bool(getattr(include_points, "default", False))
        if isinstance(points_limit, Param):
            points_limit = int(getattr(points_limit, "default", 2000))

        # When called directly (unit tests), bool Query params may be Param objects too.
        if isinstance(deals_only, Param):
            deals_only = _parse_bool(getattr(deals_only, "default", False))
        if isinstance(auction_only, Param):
            auction_only = _parse_bool(getattr(auction_only, "default", False))
        if isinstance(reduced_only, Param):
            reduced_only = _parse_bool(getattr(reduced_only, "default", False))
        if isinstance(needs_refurb_only, Param):
            needs_refurb_only = _parse_bool(getattr(needs_refurb_only, "default", False))
        if isinstance(chain_free_only, Param):
            chain_free_only = _parse_bool(getattr(chain_free_only, "default", False))
        if isinstance(tenanted_only, Param):
            tenanted_only = _parse_bool(getattr(tenanted_only, "default", False))
        if isinstance(cash_buyers_only, Param):
            cash_buyers_only = _parse_bool(getattr(cash_buyers_only, "default", False))
        if isinstance(short_lease_only, Param):
            short_lease_only = _parse_bool(getattr(short_lease_only, "default", False))
        if isinstance(below_market_only, Param):
            below_market_only = _parse_bool(getattr(below_market_only, "default", False))
        if isinstance(signals, Param):
            signals = getattr(signals, "default", None)

        # When called directly (unit tests), string Query params may also be Param objects.
        if isinstance(types, Param):
            types = getattr(types, "default", None)
        if isinstance(investment_type, Param):
            investment_type = getattr(investment_type, "default", None)
        if isinstance(property_type, Param):
            property_type = getattr(property_type, "default", None)

        response.headers["X-PropNexus-Properties-Normalization"] = PROPERTIES_NORMALIZATION_VERSION

        sb = _get_supabase()

        def _missing_col_from_api_error(err: Exception) -> str | None:
            payload = err.args[0] if getattr(err, "args", None) else None
            msg = payload.get("message") if isinstance(payload, dict) else str(err)
            if not msg:
                return None
            m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
            if not m:
                return None
            return m.group(1)

        # Normalize property_type filter values once so we can re-use for points + python fallback.
        raw_pt_values: List[str] = []
        if property_type is not None and str(property_type).strip():
            raw_pt_values = [
                str(p).strip() for p in str(property_type).split(",") if str(p).strip()
            ]

        # Normalize investment_type filter values once for deterministic tagging/filtering.
        raw_inv_values: List[str] = []
        if investment_type is not None and str(investment_type).strip():
            raw_inv_values = [
                str(p).strip() for p in str(investment_type).split(",") if str(p).strip()
            ]

        inv_synonyms: dict[str, str] = {
            "hmo": "HMO",
            "btl": "BTL",
            "sa": "SA",
            "serviced accommodation": "SA",
            "serviced_accommodation": "SA",
            "brr": "BRR",
            "brrrr": "BRR",
            "flip": "Flip",
            "commercial": "Commercial",
        }

        investment_type_filter: List[str] = []
        seen_inv: set[str] = set()
        for v in raw_inv_values:
            key = v.strip().lower()
            canon = inv_synonyms.get(key, v.strip())
            if canon and canon not in seen_inv:
                seen_inv.add(canon)
                investment_type_filter.append(canon)

        property_type_filter: List[str] = []
        seen_pt: set[str] = set()
        for v in raw_pt_values:
            canon = normalize_property_type_value(v)
            if canon and canon not in seen_pt:
                seen_pt.add(canon)
                property_type_filter.append(canon)

        raw_query_text = str(q or "").strip()
        search_terms_for_q: List[str] = []
        if raw_query_text:
            if settings.SMART_SEARCH_SYNONYMS:
                search_terms_for_q = expand_query_terms(raw_query_text)
            if not search_terms_for_q:
                search_terms_for_q = [raw_query_text]

        # We try DB filtering first; if the column doesn't exist, fall back to python filtering.
        property_type_db_value: str | None = (
            str(property_type) if property_type is not None else None
        )
        python_filter_property_type = False

        def _build_base_query(*, include_text_search: bool = True):
            q0 = sb.table("properties").select("*", count="exact")

            def _parse_csv(value: Any) -> List[str]:
                if value is None:
                    return []
                s = str(value).strip()
                if not s:
                    return []
                out: List[str] = []
                for part in s.split(","):
                    p = str(part or "").strip()
                    if p:
                        out.append(p)
                return out

            def _or_ilike(column: str, values: List[str]) -> Any:
                # Exact, case-insensitive match; OR for multiple values.
                vals = [v.strip() for v in values if isinstance(v, str) and v.strip()]
                if not vals:
                    return q0
                if len(vals) == 1:
                    try:
                        return q0.ilike(column, vals[0])
                    except Exception:
                        return q0
                # Supabase .or_ expects a comma-separated filter string.
                # Values here are expected to be simple tokens (HMO/BTL/etc). If a value
                # includes spaces, quote it.
                parts: List[str] = []
                for v in vals:
                    v2 = v.replace('"', "")
                    if any(ch.isspace() for ch in v2):
                        parts.append(f'{column}.ilike."{v2}"')
                    else:
                        parts.append(f"{column}.ilike.{v2}")
                try:
                    return q0.or_(",".join(parts))
                except Exception:
                    return q0

            # Exact source filter (useful for verifying scraper inserts)
            if source is not None:
                src = str(source).strip().lower()
                if src:
                    q0 = q0.eq("source", src)

            # Optional created_at filter (useful for "show me what just got inserted")
            if created_after is not None:
                ts = str(created_after).strip()
                if ts:
                    q0 = q0.gte("created_at", ts)

            # Search across common fields
            if include_text_search and raw_query_text:
                parts: List[str] = []
                for term in search_terms_for_q[:30]:
                    q_esc = str(term).replace("%", "").replace(",", " ").strip()
                    if not q_esc:
                        continue
                    parts.append(f"title.ilike.%{q_esc}%")
                    parts.append(f"location.ilike.%{q_esc}%")

                if parts:
                    # Supabase .or_ expects a comma-separated filter string.
                    q0 = q0.or_(",".join(parts))

            # Numeric filters
            if min is not None:
                q0 = q0.gte("price", min)
            if max is not None:
                q0 = q0.lte("price", max)
            if beds is not None:
                q0 = q0.gte("bedrooms", beds)
            if baths is not None:
                q0 = q0.gte("bathrooms", baths)

            # Types filter
            if types:
                type_list: List[str] = [t.strip() for t in types.split(",") if t.strip()]
                if type_list:
                    q0 = q0.in_("investment_type", type_list)

            # Property type filter (future use; safe/additive)
            if property_type_filter and property_type_db_value:
                try:
                    q0 = q0.in_("property_type", property_type_filter)
                except Exception:
                    pass

            return q0

        query = _build_base_query()

        deal_type_norm = normalize_deal_type(deal_type)

        # Sorting
        sort_key = (sort or "").strip().lower()
        is_recommended = sort_key in {"recommended", "best_deals"}
        sort_map = {
            "recommended": ("score", True),
            "best_deals": ("score", True),
            "created_at_desc": ("created_at", True),
            "price_asc": ("price", False),
            "price_desc": ("price", True),
            "yield_desc": ("yield_percent", True),
            "roi_desc": ("roi_percent", True),
            "score_desc": ("score", True),
        }

        if sort_key in sort_map:
            sort_col, desc = sort_map[sort_key]
            query = _safe_order(query, sort_col, desc=desc, nulls_last=True)
            # Stable fallback ordering for deterministic paging.
            if sort_col != "created_at":
                query = _safe_order(query, "created_at", desc=True, nulls_last=True)
        else:
            # Legacy behaviour: allow sorting by a column + dir=asc|desc
            sort_col = sort_key if (sort_key in ALLOWED_SORT_COLS) else "created_at"
            ascending = (dir or "").lower() == "asc"
            query = _safe_order(query, sort_col, desc=not ascending, nulls_last=True)
            if sort_col != "created_at":
                query = _safe_order(query, "created_at", desc=True, nulls_last=True)

        # Pagination
        start = offset
        end = offset + limit - 1

        required_signals: List[str] = []
        if auction_only:
            required_signals.append("auction")
        if reduced_only:
            required_signals.append("reduced")
        if needs_refurb_only:
            required_signals.append("needs_refurb")
        if chain_free_only:
            required_signals.append("chain_free")
        if tenanted_only:
            required_signals.append("tenanted")
        if cash_buyers_only:
            required_signals.append("cash_buyers_only")
        if short_lease_only:
            required_signals.append("short_lease")
        if below_market_only:
            required_signals.append("below_market")
        if signals:
            required_signals.extend(
                [s.strip().lower() for s in str(signals).split(",") if s.strip()]
            )

        any_deal_filter = bool(deals_only or required_signals)

        # For recommended ranking, we fetch a larger candidate pool from the top of the result set,
        # rerank in Python (guardrails/persona), then slice. This keeps top pages consistent while
        # remaining additive and DB-schema-free.
        fetched_pool_from_zero = False
        inv_filter_active = bool(investment_type_filter)
        needs_pool_from_zero = False
        pool_size = 0
        if is_recommended or any_deal_filter:
            pool_size = builtins.min(builtins.max(offset + limit, limit * 8), 500)
            # Only fetch from zero if the requested page fits in the capped pool.
            needs_pool_from_zero = (offset + limit) <= pool_size

        if inv_filter_active:
            inv_pool = builtins.min(builtins.max(limit * 10, 200), 500)
            pool_size = builtins.max(pool_size, inv_pool)
            needs_pool_from_zero = needs_pool_from_zero or ((offset + limit) <= pool_size)

        if needs_pool_from_zero and pool_size > 0:
            query = query.range(0, int(pool_size) - 1)
            fetched_pool_from_zero = True
        else:
            query = query.range(start, end)

        fallback_sort = sort_key in {"price_asc", "price_desc", "yield_desc", "roi_desc"}
        try:
            res = query.execute()
        except APIError as e:
            missing = _missing_col_from_api_error(e)
            if missing == "property_type" and property_type_filter:
                python_filter_property_type = True
                property_type_db_value = None
                query = _build_base_query()
                # Preserve sorting behavior.
                if sort_key in sort_map:
                    sort_col, desc = sort_map[sort_key]
                    query = _safe_order(query, sort_col, desc=desc, nulls_last=True)
                    if sort_col != "created_at":
                        query = _safe_order(query, "created_at", desc=True, nulls_last=True)
                else:
                    sort_col = sort_key if (sort_key in ALLOWED_SORT_COLS) else "created_at"
                    ascending = (dir or "").lower() == "asc"
                    query = _safe_order(query, sort_col, desc=not ascending, nulls_last=True)
                    if sort_col != "created_at":
                        query = _safe_order(query, "created_at", desc=True, nulls_last=True)

                # If we're going to python-filter, fetch a candidate pool from zero.
                pool_size = builtins.min(builtins.max(offset + limit, limit * 8), 500)
                query = query.range(0, pool_size - 1)
                fetched_pool_from_zero = True

                res = query.execute()
            else:
                raise
        except Exception:
            # If PostgREST/supabase cannot order/cast cleanly (e.g. mixed/legacy data),
            # fall back to a safe server-side sort based on normalized values.
            if not fallback_sort:
                raise

            query = _build_base_query()
            query = _safe_order(query, "created_at", desc=True, nulls_last=True)
            query = query.range(start, end)
            res = query.execute()
        rows = res.data or []
        if not isinstance(rows, list):
            rows = []

        total = getattr(res, "count", None)
        total_int = int(total) if isinstance(total, (int, float)) else 0

        items = [_normalize_property_row(r) for r in rows if isinstance(r, dict)]

        # Postgres-only fuzzy fallback (pg_trgm + levenshtein<=1) for typo tolerance.
        if (
            settings.SMART_SEARCH_SYNONYMS
            and raw_query_text
            and not items
            and total_int == 0
            and search_terms_for_q
        ):
            try:
                fuzzy_ids: List[str] = []

                if is_postgres_detected():
                    fuzzy_ids = fetch_postgres_fuzzy_ids(
                        raw_query_text,
                        search_terms_for_q,
                        limit=builtins.max(limit * 3, 50),
                    )

                if not fuzzy_ids:
                    candidate_limit = builtins.max(limit * 10, 200)
                    candidate_query = _build_base_query(include_text_search=False)
                    candidate_query = _safe_order(
                        candidate_query, "created_at", desc=True, nulls_last=True
                    )
                    candidate_query = candidate_query.range(0, int(candidate_limit) - 1)
                    candidate_res = candidate_query.execute()
                    candidate_rows = candidate_res.data or []

                    if isinstance(candidate_rows, list):

                        def _row_score(row: dict[str, Any]) -> float:
                            raw_blob = " ".join(
                                [
                                    str(row.get("title") or ""),
                                    str(row.get("description") or ""),
                                    str(row.get("location") or ""),
                                    str(row.get("postcode") or ""),
                                ]
                            ).lower()
                            tokens = [
                                tok for tok in re.split(r"[^a-z0-9]+", raw_blob) if len(tok) >= 3
                            ]
                            if not tokens:
                                return 0.0

                            best = 0.0
                            for term in search_terms_for_q[:10]:
                                term_norm = str(term or "").strip().lower()
                                if len(term_norm) < 3:
                                    continue
                                if term_norm in tokens:
                                    return 1.0
                                for tok in tokens[:500]:
                                    ratio = difflib.SequenceMatcher(None, term_norm, tok).ratio()
                                    if ratio > best:
                                        best = ratio
                            return best

                        scored = [
                            (str(r.get("id") or ""), _row_score(r))
                            for r in candidate_rows
                            if isinstance(r, dict) and str(r.get("id") or "").strip()
                        ]
                        scored = [pair for pair in scored if pair[1] >= 0.84]
                        scored.sort(key=lambda pair: pair[1], reverse=True)
                        fuzzy_ids = [pid for pid, _score in scored[:500]]

                if fuzzy_ids:
                    ranked_ids = [str(i) for i in fuzzy_ids[:500] if str(i).strip()]
                    id_position = {pid: idx for idx, pid in enumerate(ranked_ids)}

                    fuzzy_query = _build_base_query(include_text_search=False)
                    fuzzy_query = fuzzy_query.in_("id", ranked_ids)
                    fuzzy_query = fuzzy_query.range(0, builtins.max(len(ranked_ids) - 1, 0))

                    fuzzy_res = fuzzy_query.execute()
                    fuzzy_rows = fuzzy_res.data or []
                    if isinstance(fuzzy_rows, list):
                        filtered_ranked = sorted(
                            [
                                _normalize_property_row(r)
                                for r in fuzzy_rows
                                if isinstance(r, dict) and str(r.get("id") or "") in id_position
                            ],
                            key=lambda row: id_position.get(str(row.get("id") or ""), 10**9),
                        )

                        total_int = len(filtered_ranked)
                        items = filtered_ranked[offset : offset + limit]
            except Exception:
                pass

        # Attach cached enrichment (geo/crime/comps/derived) where available.
        try:
            missing_ids = _attach_enrichment_from_cache(sb, items)

            if (os.getenv("ENRICH_ON_READ_LIST") or "0") == "1":
                max_kicks = int(os.getenv("ENRICH_ON_READ_LIST_LIMIT", "3"))
                for pid in (missing_ids or [])[: max(0, max_kicks)]:
                    _start_enrichment_thread(pid)
        except Exception:
            pass

        # Add deterministic investment tags for debugging / future UI, and optionally filter.
        if items:
            for it in items:
                try:
                    it["investment_types"] = sorted(classify_investment_types(it))
                except Exception:
                    it["investment_types"] = []

            if inv_filter_active:
                requested = set(investment_type_filter)
                items = [
                    it
                    for it in items
                    if requested.intersection(set(it.get("investment_types") or []))
                ]
                if fetched_pool_from_zero:
                    total_int = len(items)

        if property_type_filter and not python_filter_property_type:
            # Even with DB filtering, ensure output is normalized for legacy rows.
            pass

        if property_type_filter and python_filter_property_type and items:
            allowed = set(property_type_filter)
            items = [it for it in items if it.get("property_type") in allowed]
            if fetched_pool_from_zero:
                total_int = len(items)

        if (is_recommended or any_deal_filter) and items:
            items = [_ensure_deal_fields(it) for it in items if isinstance(it, dict)]

            if any_deal_filter:
                items = [
                    it
                    for it in items
                    if _matches_deal_filters(
                        it.get("deal_signals"),
                        deals_only=deals_only,
                        required_signals=required_signals,
                    )
                ]

                # When filtering within a pool, the DB count is no longer meaningful.
                if fetched_pool_from_zero:
                    total_int = len(items)

        if is_recommended and items:
            # Enrich + rerank deterministically. We still return the same page size.
            ranked = rerank_recommended(
                items,
                deal_type=deal_type_norm,
                min_tier2=builtins.max(5, int(limit // 3)),
                query_text=q,
            )
            if fetched_pool_from_zero:
                items = ranked[offset : offset + limit]
            else:
                items = ranked
        elif fetched_pool_from_zero and any_deal_filter:
            # Non-recommended + deal filters: slice after filtering.
            items = items[offset : offset + limit]
        elif fetched_pool_from_zero and property_type_filter and python_filter_property_type:
            # Non-recommended + python property_type filtering: slice after filtering.
            items = items[offset : offset + limit]
        elif fetched_pool_from_zero and inv_filter_active:
            # Non-recommended + investment type filtering: slice after filtering.
            items = items[offset : offset + limit]

        points: Optional[List[Dict[str, Any]]] = None
        if include_points:
            # Minimal payload for map pinning. We intentionally do not include images/raw payload.
            def _build_points_query():
                cols = "id,title,location,price,bedrooms,investment_type,latitude,longitude,source,created_at"
                if any_deal_filter:
                    cols = cols + ",deal_signals,data"

                if inv_filter_active:
                    # Deterministic investment tagging needs text + discount/signals + type.
                    if "property_type" not in cols:
                        cols = cols + ",property_type"
                    if "description" not in cols:
                        cols = cols + ",description"
                    if "deal_signals" not in cols:
                        cols = cols + ",deal_signals"
                    if "discount_estimate_pct" not in cols:
                        cols = cols + ",discount_estimate_pct"
                    if "data" not in cols:
                        cols = cols + ",data"

                # Include data so we can compute property_type consistently if needed.
                if property_type_filter and "data" not in cols:
                    cols = cols + ",data"
                if property_type_filter and "description" not in cols:
                    cols = cols + ",description"

                q0 = sb.table("properties").select(cols)

                if source is not None:
                    src = str(source).strip().lower()
                    if src:
                        q0 = q0.eq("source", src)

                if created_after is not None:
                    ts = str(created_after).strip()
                    if ts:
                        q0 = q0.gte("created_at", ts)

                if q:
                    q_esc = q.replace("%", "").strip()
                    if q_esc:
                        q0 = q0.or_(f"title.ilike.%{q_esc}%,location.ilike.%{q_esc}%")

                if min is not None:
                    q0 = q0.gte("price", min)
                if max is not None:
                    q0 = q0.lte("price", max)
                if beds is not None:
                    q0 = q0.gte("bedrooms", beds)
                if baths is not None:
                    q0 = q0.gte("bathrooms", baths)

                if types:
                    type_list: List[str] = [t.strip() for t in types.split(",") if t.strip()]
                    if type_list:
                        q0 = q0.in_("investment_type", type_list)

                # Investment type filter (new param)
                # NOTE: we intentionally do NOT push investment_type down to the DB here.
                # The API applies a deterministic Python-side tag filter so results are
                # consistent even when the DB column is missing/incorrect.

                # Property type filter (DB-side when possible)
                if property_type_filter and property_type_db_value:
                    try:
                        q0 = q0.in_("property_type", property_type_filter)
                    except Exception:
                        pass

                return q0

            points_q = _build_points_query()
            # Deterministic ordering for stable point sets.
            points_q = _safe_order(points_q, "created_at", desc=True, nulls_last=True)
            points_q = points_q.range(0, points_limit - 1)

            try:
                points_res = points_q.execute()
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if missing == "property_type" and property_type_filter:
                    # Rebuild without DB property_type filtering; python-filter below.
                    property_type_db_value = None
                    python_filter_property_type = True
                    points_q = _build_points_query()
                    points_q = _safe_order(points_q, "created_at", desc=True, nulls_last=True)
                    points_q = points_q.range(0, points_limit - 1)
                    points_res = points_q.execute()
                else:
                    raise
            points_rows = points_res.data or []
            if not isinstance(points_rows, list):
                points_rows = []

            def _coerce_float(v: Any) -> float | None:
                if v is None or isinstance(v, bool):
                    return None
                if isinstance(v, (int, float)):
                    f = float(v)
                elif isinstance(v, str):
                    try:
                        f = float(v.strip())
                    except Exception:
                        return None
                else:
                    return None
                if not (f == f):
                    return None
                return f

            def _coerce_int(v: Any) -> int | None:
                if v is None or isinstance(v, bool):
                    return None
                if isinstance(v, int):
                    return v
                if isinstance(v, float):
                    if v == v:
                        return int(v)
                    return None
                if isinstance(v, str):
                    s = v.strip()
                    if not s:
                        return None
                    cleaned = "".join(ch for ch in s if ch.isdigit())
                    if not cleaned:
                        return None
                    try:
                        return int(cleaned)
                    except Exception:
                        return None
                return None

            points_out: List[Dict[str, Any]] = []
            for r in points_rows:
                if not isinstance(r, dict):
                    continue

                if inv_filter_active:
                    try:
                        # Ensure property_type is present for HMO soft-signal (beds + house types).
                        if not (
                            isinstance(r.get("property_type"), str)
                            and r.get("property_type").strip()
                        ):
                            pt, _raw = classify_property_type(
                                r.get("title"),
                                r.get("description"),
                                None,
                                extra=r.get("data") if isinstance(r.get("data"), dict) else None,
                            )
                            r["property_type"] = pt
                        tags = classify_investment_types(r)
                        if not tags.intersection(set(investment_type_filter)):
                            continue
                    except Exception:
                        continue

                if property_type_filter and python_filter_property_type:
                    try:
                        pt, _raw = classify_property_type(
                            r.get("title"),
                            r.get("description"),
                            None,
                            extra=r.get("data") if isinstance(r.get("data"), dict) else None,
                        )
                        if pt not in set(property_type_filter):
                            continue
                    except Exception:
                        continue

                if any_deal_filter:
                    deal_sigs = r.get("deal_signals")
                    if deal_sigs is None and isinstance(r.get("data"), dict):
                        deal_sigs = r["data"].get("deal_signals")
                    if not _matches_deal_filters(
                        deal_sigs,
                        deals_only=deals_only,
                        required_signals=required_signals,
                    ):
                        continue

                lat = _coerce_float(
                    r.get("latitude") if r.get("latitude") is not None else r.get("lat")
                )
                lng = _coerce_float(
                    r.get("longitude")
                    if r.get("longitude") is not None
                    else (r.get("lng") if r.get("lng") is not None else r.get("lon"))
                )
                # Only treat (0,0) as placeholder.
                if lat == 0.0 and lng == 0.0:
                    lat = None
                    lng = None

                points_out.append(
                    {
                        "id": r.get("id"),
                        "title": r.get("title"),
                        "location": r.get("location"),
                        "price": (
                            _coerce_int(r.get("price")) if r.get("price") is not None else None
                        ),
                        "bedrooms": (
                            _coerce_int(r.get("bedrooms"))
                            if r.get("bedrooms") is not None
                            else None
                        ),
                        "investment_type": r.get("investment_type"),
                        "latitude": lat,
                        "longitude": lng,
                        "source": r.get("source"),
                    }
                )

            points = points_out

        # Ensure numeric-safe sorting (nulls last) for common UI sorts.
        # Python sorting is stable, so the secondary created_at ordering remains for ties.
        def _num(v: Any) -> float | None:
            if v is None or isinstance(v, bool):
                return None
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str):
                try:
                    return float(v.strip())
                except Exception:
                    return None
            return None

        if sort_key == "price_asc":
            items.sort(key=lambda it: (_num(it.get("price")) is None, _num(it.get("price")) or 0))
        elif sort_key == "price_desc":
            items.sort(
                key=lambda it: (
                    _num(it.get("price")) is None,
                    -(_num(it.get("price")) or 0),
                )
            )
        elif sort_key == "yield_desc":
            items.sort(
                key=lambda it: (
                    _num(it.get("yield_percent")) is None,
                    -(_num(it.get("yield_percent")) or 0),
                )
            )
        elif sort_key == "roi_desc":
            items.sort(
                key=lambda it: (
                    _num(it.get("roi_percent")) is None,
                    -(_num(it.get("roi_percent")) or 0),
                )
            )
        mappable_count = sum(
            1
            for it in items
            if _is_mappable_coordinate_pair(it.get("latitude"), it.get("longitude"))
        )
        has_more = (offset + limit) < total_int

        return {
            "items": items,
            "points": points,
            "total": total_int,
            "mappable_count": int(mappable_count),
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Never 500 silently: return message for debugging
        raise HTTPException(status_code=500, detail=f"properties list failed: {e}")


@router.post("/properties/admin/backfill-property-types")
def backfill_property_types(
    request: Request,
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100_000),
    x_admin_token: str | None = Header(None),
):
    """Backfill canonical property_type/raw_property_type.

    Safe + repeatable:
    - Computes type from title/description/data
    - Writes to columns when available, otherwise embeds into data JSON
    """

    require_admin(request)
    sb = _get_supabase()

    cols = [
        "id",
        "title",
        "description",
        "data",
        "created_at",
        "property_type",
        "raw_property_type",
    ]

    def _missing_col_from_api_error(err: APIError) -> str | None:
        payload = err.args[0] if err.args else None
        msg = payload.get("message") if isinstance(payload, dict) else str(err)
        if not msg:
            return None
        m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
        if not m:
            return None
        return m.group(1)

    def _select_with_existing_cols(build_query):
        nonlocal cols
        for _ in range(10):
            try:
                select_cols = ",".join(cols)
                return build_query(select_cols).execute()
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if not missing:
                    raise
                if missing in cols and missing != "id":
                    cols = [c for c in cols if c != missing]
                    continue
                raise
        raise HTTPException(
            status_code=500,
            detail="Backfill failed: could not find a compatible column set",
        )

    try:
        res = _select_with_existing_cols(
            lambda select_cols: (
                _safe_order(
                    sb.table("properties")
                    .select(select_cols)
                    .range(int(offset), int(offset) + int(limit) - 1),
                    "created_at",
                    desc=True,
                )
                if "created_at" in cols
                else sb.table("properties")
                .select(select_cols)
                .range(int(offset), int(offset) + int(limit) - 1)
            )
        )
        rows = res.data or []
        if not isinstance(rows, list):
            rows = []

        processed = 0
        updated = 0
        sample_updates: list[dict[str, Any]] = []

        for r in rows:
            if not isinstance(r, dict) or not r.get("id"):
                continue
            processed += 1
            pid = str(r.get("id"))

            data_obj = r.get("data")
            if not isinstance(data_obj, dict):
                data_obj = {} if data_obj in (None, "") else {"raw": data_obj}

            existing = r.get("property_type")
            if not (isinstance(existing, str) and existing.strip()):
                existing = data_obj.get("property_type")

            if isinstance(existing, str) and existing.strip():
                continue

            pt, raw_best = classify_property_type(
                r.get("title"),
                r.get("description"),
                None,
                extra=data_obj,
            )

            data_obj["property_type"] = pt
            if raw_best:
                data_obj["raw_property_type"] = raw_best

            payload: dict[str, Any] = {"data": data_obj, "property_type": pt}
            if raw_best:
                payload["raw_property_type"] = raw_best

            try:
                sb.table("properties").update(payload).eq("id", pid).execute()
                updated += 1
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if missing in {"property_type", "raw_property_type"}:
                    retry_payload = {"data": data_obj}
                    sb.table("properties").update(retry_payload).eq("id", pid).execute()
                    updated += 1
                else:
                    logging.exception("Failed to backfill property_type for %s", pid)

            if len(sample_updates) < 5:
                sample_updates.append(
                    {"id": pid, "property_type": pt, "raw_property_type": raw_best}
                )

        return {
            "processed_count": processed,
            "updated_count": updated,
            "limit": limit,
            "offset": offset,
            "sample_updates": sample_updates,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Backfill property types failed")
        raise HTTPException(status_code=500, detail="Backfill failed") from e


@router.get("/properties/{property_id}")
def get_property(property_id: str, response: Response):
    try:
        response.headers["X-PropNexus-Properties-Normalization"] = PROPERTIES_NORMALIZATION_VERSION

        sb = _get_supabase()
        query = sb.table("properties").select("*").eq("id", property_id).maybe_single()
        res = query.execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Property not found")

        if isinstance(res.data, dict):
            out = _normalize_property_row(res.data)
            try:
                cached = get_property_enrichment_cache(sb, property_id)
                payload = cached.get("payload") if isinstance(cached, dict) else None
                _attach_cached_enrichment(out, payload)

                if not cached and (os.getenv("ENRICH_ON_READ_DETAIL") or "0") == "1":
                    _start_enrichment_thread(property_id)
            except Exception:
                pass
            return out
        return res.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"property fetch failed: {e}")


@router.post("/properties/admin/backfill-scores")
def backfill_property_scores(
    request: Request,
    limit: int = Query(default=200, ge=1, le=500),
    force: bool = Query(default=False),
    recompute: bool = Query(default=False),
    only_null: bool = Query(default=True),
    x_admin_token: str | None = Header(None),
):
    """Backfill deal scores.

    Default behavior is conservative: only rows where `score IS NULL` or `score <= 0`.

    To rescore already-scored rows (useful after scoring-logic changes), pass one of:
      - `force=true`
      - `recompute=true`
      - `only_null=false`

    Bounded by `limit` and best-effort; failures per-row do not abort the run.
    """

    require_admin(request)

    sb = _get_supabase()
    try:
        cols = [
            "id",
            "title",
            "location",
            "address",
            "postcode",
            "price",
            "asking_price",
            "bedrooms",
            "yield_percent",
            "rental_yield_percent",
            "roi_percent",
            "rent",
            "avg_rent",
            "crime_index",
            "schools_rating",
            "data",
            "score",
            "score_updated_at",
        ]

        def _missing_col_from_api_error(err: APIError) -> str | None:
            payload = err.args[0] if err.args else None
            msg = payload.get("message") if isinstance(payload, dict) else str(err)
            if not msg:
                return None
            m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
            if not m:
                return None
            return m.group(1)

        def _select_with_existing_cols(build_query):
            nonlocal cols
            for _ in range(10):
                try:
                    select_cols = ",".join(cols)
                    return build_query(select_cols).execute()
                except APIError as e:
                    missing = _missing_col_from_api_error(e)
                    if not missing:
                        raise
                    if missing == "score":
                        raise HTTPException(
                            status_code=500,
                            detail="Backfill failed: DB is missing properties.score (apply the deal score migration first)",
                        )
                    if missing in cols and missing != "id":
                        cols = [c for c in cols if c != missing]
                        continue
                    raise
            raise HTTPException(
                status_code=500, detail="Backfill failed: could not find a compatible column set"
            )

        force_all = bool(force or recompute or (not only_null))

        if force_all:
            res_all = _select_with_existing_cols(
                lambda select_cols: (
                    _safe_order(
                        sb.table("properties").select(select_cols).limit(int(limit)),
                        "score_updated_at",
                        desc=False,
                    )
                    if "score_updated_at" in cols
                    else sb.table("properties").select(select_cols).limit(int(limit))
                )
            )
            rows = res_all.data or []
            if not isinstance(rows, list):
                rows = []
        else:
            res_null = _select_with_existing_cols(
                lambda select_cols: sb.table("properties")
                .select(select_cols)
                .is_("score", "null")
                .limit(int(limit))
            )
            null_rows = res_null.data or []
            if not isinstance(null_rows, list):
                null_rows = []

            res_zero = _select_with_existing_cols(
                lambda select_cols: sb.table("properties")
                .select(select_cols)
                .lte("score", 0)
                .limit(int(limit))
            )
            zero_rows = res_zero.data or []
            if not isinstance(zero_rows, list):
                zero_rows = []

            merged_by_id: dict[str, dict] = {}
            for r in [*null_rows, *zero_rows]:
                if isinstance(r, dict) and r.get("id"):
                    merged_by_id[str(r["id"])] = r

            rows = list(merged_by_id.values())[: int(limit)]
        attempted = len(rows)
        updated = 0

        for r in rows:
            if not isinstance(r, dict):
                continue
            pid = r.get("id")
            if not pid:
                continue

            try:
                score, breakdown = compute_deal_score(r)
                payload = {
                    "score": score,
                    "score_breakdown": breakdown,
                    "score_updated_at": datetime.now(timezone.utc).isoformat(),
                }
                sb.table("properties").update(payload).eq("id", str(pid)).execute()
                updated += 1
            except Exception:
                logging.exception("Failed to backfill score for property %s", pid)

        return {"attempted": attempted, "updated": updated, "force": force_all}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Backfill property scores failed")
        raise HTTPException(status_code=500, detail="Backfill failed") from e


@router.get("/properties/admin/score-stats")
def admin_score_stats(request: Request, x_admin_token: str | None = Header(None)):
    """Admin stats for diagnosing why scoring/backfill does (or doesn't) run."""

    require_admin(request)
    sb = _get_supabase()

    def _count(build_query) -> int | None:
        try:
            res = build_query(sb.table("properties").select("id", count="exact").limit(1)).execute()
            return getattr(res, "count", None)
        except Exception:
            return None

    total = _count(lambda q: q)
    score_null = _count(lambda q: q.is_("score", "null"))
    score_le_zero = _count(lambda q: q.lte("score", 0))
    score_updated_at_null = _count(lambda q: q.is_("score_updated_at", "null"))

    yield_null = _count(lambda q: q.is_("yield_percent", "null"))
    roi_null = _count(lambda q: q.is_("roi_percent", "null"))
    postcode_null = _count(lambda q: q.is_("postcode", "null"))
    lat_null = _count(lambda q: q.is_("latitude", "null"))
    lng_null = _count(lambda q: q.is_("longitude", "null"))

    return {
        "total": total,
        "score_null": score_null,
        "score_le_zero": score_le_zero,
        "score_updated_at_null": score_updated_at_null,
        "yield_percent_null": yield_null,
        "roi_percent_null": roi_null,
        "postcode_null": postcode_null,
        "latitude_null": lat_null,
        "longitude_null": lng_null,
    }


@router.get("/properties/admin/score-sample")
def admin_score_sample(
    request: Request,
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10_000),
    x_admin_token: str | None = Header(None),
):
    """Return a small sample of rows to validate scoring in production."""

    require_admin(request)
    sb = _get_supabase()

    cols = [
        "id",
        "title",
        "postcode",
        "bedrooms",
        "price",
        "yield_percent",
        "roi_percent",
        "score",
        "score_breakdown",
        "created_at",
    ]

    def _missing_col_from_api_error(err: APIError) -> str | None:
        payload = err.args[0] if err.args else None
        msg = payload.get("message") if isinstance(payload, dict) else str(err)
        if not msg:
            return None
        m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
        if not m:
            return None
        return m.group(1)

    def _select_with_existing_cols(build_query):
        nonlocal cols
        for _ in range(10):
            try:
                select_cols = ",".join(cols)
                return build_query(select_cols).execute()
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if not missing:
                    raise
                if missing in cols and missing != "id":
                    cols = [c for c in cols if c != missing]
                    continue
                raise
        raise HTTPException(
            status_code=500, detail="Score sample failed: could not find a compatible column set"
        )

    res = _select_with_existing_cols(
        lambda select_cols: (
            _safe_order(
                sb.table("properties")
                .select(select_cols)
                .range(int(offset), int(offset) + int(limit) - 1),
                "created_at",
                desc=True,
            )
            if "created_at" in cols
            else sb.table("properties")
            .select(select_cols)
            .range(int(offset), int(offset) + int(limit) - 1)
        )
    )

    rows = res.data or []
    if not isinstance(rows, list):
        rows = []

    items = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        bd = r.get("score_breakdown")
        version = None
        inputs_out: dict[str, Any] = {}
        if isinstance(bd, dict):
            version = bd.get("version")
            inputs = bd.get("inputs")
            if isinstance(inputs, dict):
                for k in (
                    "rent_source",
                    "postcode_band",
                    "rent_monthly",
                    "cap_rate_proxy_percent",
                ):
                    if k in inputs:
                        inputs_out[k] = inputs.get(k)

        items.append(
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "postcode": r.get("postcode"),
                "bedrooms": r.get("bedrooms"),
                "price": r.get("price"),
                "yield_percent": r.get("yield_percent"),
                "roi_percent": r.get("roi_percent"),
                "score": r.get("score"),
                "score_breakdown": {"version": version, "inputs": inputs_out},
            }
        )

    return {"items": items, "limit": limit, "offset": offset}


@router.get("/properties/admin/score-debug-one")
def admin_score_debug_one(
    request: Request,
    id: str = Query(..., min_length=1),
    x_admin_token: str | None = Header(None),
):
    """Fetch one property row and compare stored vs computed deal score.

    Useful when production shows `score_breakdown.version=v1.1` but
    inputs indicate `rent_source=missing` unexpectedly.
    """

    require_admin(request)
    sb = _get_supabase()

    cols = [
        "id",
        "title",
        "location",
        "address",
        "postcode",
        "price",
        "asking_price",
        "bedrooms",
        "yield_percent",
        "rental_yield_percent",
        "roi_percent",
        "rent",
        "avg_rent",
        "crime_index",
        "schools_rating",
        "data",
        "score",
        "score_breakdown",
        "score_updated_at",
        "created_at",
    ]

    def _missing_col_from_api_error(err: APIError) -> str | None:
        payload = err.args[0] if err.args else None
        msg = payload.get("message") if isinstance(payload, dict) else str(err)
        if not msg:
            return None
        m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
        if not m:
            return None
        return m.group(1)

    def _select_with_existing_cols(build_query):
        nonlocal cols
        for _ in range(10):
            try:
                select_cols = ",".join(cols)
                return build_query(select_cols).execute()
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if not missing:
                    raise
                if missing in cols and missing != "id":
                    cols = [c for c in cols if c != missing]
                    continue
                raise
        raise HTTPException(
            status_code=500,
            detail="Score debug failed: could not find a compatible column set",
        )

    res = _select_with_existing_cols(
        lambda select_cols: sb.table("properties").select(select_cols).eq("id", id).maybe_single()
    )
    row = res.data
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Property not found")

    computed_score, computed_breakdown = compute_deal_score(row)
    stored_breakdown = (
        row.get("score_breakdown") if isinstance(row.get("score_breakdown"), dict) else None
    )

    return {
        "id": row.get("id"),
        "stored": {
            "score": row.get("score"),
            "score_updated_at": row.get("score_updated_at"),
            "breakdown": stored_breakdown,
        },
        "computed": {
            "score": computed_score,
            "breakdown": computed_breakdown,
        },
        "inputs": {
            "title": row.get("title"),
            "location": row.get("location"),
            "address": row.get("address"),
            "postcode": row.get("postcode"),
            "bedrooms": row.get("bedrooms"),
            "price": row.get("price") or row.get("asking_price"),
            "yield_percent": row.get("yield_percent") or row.get("rental_yield_percent"),
            "roi_percent": row.get("roi_percent"),
            "rent": row.get("rent") or row.get("avg_rent"),
        },
    }


@router.post("/properties/admin/backfill-postcodes")
def backfill_property_postcodes(
    request: Request,
    limit: int = Query(default=500, ge=1, le=2000),
    force: bool = Query(default=False),
    x_admin_token: str | None = Header(None),
):
    """Backfill missing UK postcodes from existing text fields.

    - Default: only updates rows where `postcode` is NULL/empty.
    - `force=true`: scans rows regardless of existing postcode (still only writes
      when we can extract a postcode and it differs).

    Repeatable + best-effort; per-row failures don't abort the run.
    """

    require_admin(request)
    sb = _get_supabase()

    cols = [
        "id",
        "postcode",
        "title",
        "location",
        "address",
        "created_at",
    ]

    def _missing_col_from_api_error(err: APIError) -> str | None:
        payload = err.args[0] if err.args else None
        msg = payload.get("message") if isinstance(payload, dict) else str(err)
        if not msg:
            return None
        m = re.search(r"column properties\.([a-zA-Z0-9_]+) does not exist", msg)
        if not m:
            return None
        return m.group(1)

    def _select_with_existing_cols(build_query):
        nonlocal cols
        for _ in range(10):
            try:
                select_cols = ",".join(cols)
                return build_query(select_cols).execute()
            except APIError as e:
                missing = _missing_col_from_api_error(e)
                if not missing:
                    raise
                if missing in cols and missing != "id":
                    cols = [c for c in cols if c != missing]
                    continue
                raise
        raise HTTPException(
            status_code=500, detail="Backfill failed: could not find a compatible column set"
        )

    try:
        if force:
            res = _select_with_existing_cols(
                lambda select_cols: (
                    _safe_order(
                        sb.table("properties").select(select_cols).limit(int(limit)),
                        "created_at",
                        desc=True,
                    )
                    if "created_at" in cols
                    else sb.table("properties").select(select_cols).limit(int(limit))
                )
            )
            rows = res.data or []
            if not isinstance(rows, list):
                rows = []
        else:
            # Prefer a server-side NULL filter. If some rows use empty-string postcodes,
            # we handle that client-side below.
            res = _select_with_existing_cols(
                lambda select_cols: (
                    _safe_order(
                        sb.table("properties")
                        .select(select_cols)
                        .is_("postcode", "null")
                        .limit(int(limit)),
                        "created_at",
                        desc=True,
                    )
                    if "created_at" in cols
                    else sb.table("properties")
                    .select(select_cols)
                    .is_("postcode", "null")
                    .limit(int(limit))
                )
            )
            rows = res.data or []
            if not isinstance(rows, list):
                rows = []

        attempted = len(rows)
        updated = 0

        for r in rows:
            if not isinstance(r, dict):
                continue
            pid = r.get("id")
            if not pid:
                continue

            existing_raw = r.get("postcode")
            existing_norm = extract_postcode(existing_raw)

            missing_pc = not (isinstance(existing_raw, str) and existing_raw.strip())
            if (not force) and (not missing_pc):
                continue

            candidate = (
                existing_norm
                or extract_postcode(r.get("title"))
                or extract_postcode(r.get("location"))
                or extract_postcode(r.get("address"))
            )
            if not candidate:
                continue

            # Avoid unnecessary writes.
            if existing_norm and existing_norm == candidate:
                continue

            try:
                sb.table("properties").update({"postcode": candidate}).eq("id", str(pid)).execute()
                updated += 1
            except Exception:
                logging.exception("Failed to backfill postcode for property %s", pid)

        return {"attempted": attempted, "updated": updated, "force": force}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Backfill property postcodes failed")
        raise HTTPException(status_code=500, detail="Backfill failed") from e
