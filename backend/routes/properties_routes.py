from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Response

from backend.utils.image_utils import dedupe_image_urls, pick_cover_image
from supabase import create_client

router = APIRouter(tags=["properties"])

# Allowed sort columns (tests expect invalid -> fallback, not 500)
ALLOWED_SORT_COLS = {
    "created_at",
    "price",
    "bedrooms",
    "bathrooms",
    "yield_percent",
    "roi_percent",
    "ai_score",
}


PROPERTIES_NORMALIZATION_VERSION = "v1"


def _get_supabase():
    """
    Lazily create Supabase client so unit tests can patch create_client.
    Also avoids crashing if env vars aren't set in CI.
    """
    url = os.getenv("SUPABASE_URL") or "http://localhost"
    key = os.getenv("SUPABASE_KEY") or "anon"
    return create_client(url, key)


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

    def _pick_raw(keys: List[str]) -> Any:
        for k in keys:
            v = raw_obj.get(k)
            if v not in (None, "", [], {}):
                return v
        return None

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
    if out.get("price") in (None, 0, 0.0, ""):
        raw_price = _pick_raw(["price", "displayPrice", "display_price"])
        price = _coerce_int(raw_price)
        if price is not None and price > 0:
            out["price"] = price

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

    return out


@router.get("/properties")
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
    sort: Optional[str] = Query(default=None),
    dir: str = Query(default="desc"),
    limit: int = Query(default=200, ge=1, le=1000),
):
    try:
        response.headers["X-PropNexus-Properties-Normalization"] = PROPERTIES_NORMALIZATION_VERSION

        sb = _get_supabase()
        query = sb.table("properties").select("*")

        # Exact source filter (useful for verifying scraper inserts)
        if source is not None:
            src = str(source).strip().lower()
            if src:
                query = query.eq("source", src)

        # Optional created_at filter (useful for "show me what just got inserted")
        if created_after is not None:
            ts = str(created_after).strip()
            if ts:
                query = query.gte("created_at", ts)

        # Search across common fields
        if q:
            q_esc = q.replace("%", "").strip()
            if q_esc:
                # Supabase .or_ expects a comma-separated filter string
                query = query.or_(f"title.ilike.%{q_esc}%,location.ilike.%{q_esc}%")

        # Numeric filters
        if min is not None:
            query = query.gte("price", min)
        if max is not None:
            query = query.lte("price", max)
        if beds is not None:
            query = query.gte("bedrooms", beds)
        if baths is not None:
            query = query.gte("bathrooms", baths)

        # Types filter
        if types:
            type_list: List[str] = [t.strip() for t in types.split(",") if t.strip()]
            if type_list:
                query = query.in_("investment_type", type_list)

        # Sort fallback behaviour (tests expect this)
        sort_col = sort if (sort in ALLOWED_SORT_COLS) else "created_at"
        ascending = (dir or "").lower() == "asc"
        query = query.order(sort_col, desc=not ascending)

        query = query.limit(limit)
        res = query.execute()
        rows = res.data or []
        if not isinstance(rows, list):
            return []
        return [_normalize_property_row(r) for r in rows if isinstance(r, dict)]

    except HTTPException:
        raise
    except Exception as e:
        # Never 500 silently: return message for debugging
        raise HTTPException(status_code=500, detail=f"properties list failed: {e}")


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
            return _normalize_property_row(res.data)
        return res.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"property fetch failed: {e}")
