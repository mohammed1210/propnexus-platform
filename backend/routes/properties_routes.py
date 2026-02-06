from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Response
from fastapi.params import Param
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from backend.utils.deal_scoring import compute_deal_score
from backend.utils.image_utils import dedupe_image_urls, pick_cover_image
from backend.utils.listing_keys import extract_postcode
from supabase import create_client

router = APIRouter(tags=["properties"])


def _require_admin(x_admin_token: str | None = None) -> None:
    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if required and x_admin_token != required:
        raise HTTPException(status_code=401, detail="Admin token required")


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
    Also avoids crashing if env vars aren't set in CI.
    """
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "http://localhost"
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or "anon"
    )
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

    return out


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
    sort: str = Query(
        default="created_at_desc",
        description=(
            "Sort order. Preferred values: created_at_desc, price_asc, price_desc, "
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

        response.headers["X-PropNexus-Properties-Normalization"] = PROPERTIES_NORMALIZATION_VERSION

        sb = _get_supabase()

        def _build_base_query():
            q0 = sb.table("properties").select("*", count="exact")

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
            if q:
                q_esc = q.replace("%", "").strip()
                if q_esc:
                    # Supabase .or_ expects a comma-separated filter string
                    q0 = q0.or_(f"title.ilike.%{q_esc}%,location.ilike.%{q_esc}%")

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

            return q0

        query = _build_base_query()

        # Sorting
        sort_key = (sort or "").strip().lower()
        sort_map = {
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
        query = query.range(start, end)

        fallback_sort = sort_key in {"price_asc", "price_desc", "yield_desc", "roi_desc"}
        try:
            res = query.execute()
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

        points: Optional[List[Dict[str, Any]]] = None
        if include_points:
            # Minimal payload for map pinning. We intentionally do not include images/raw payload.
            def _build_points_query():
                q0 = sb.table("properties").select(
                    "id,title,location,price,bedrooms,investment_type,latitude,longitude,source,created_at"
                )

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

                return q0

            points_q = _build_points_query()
            # Deterministic ordering for stable point sets.
            points_q = _safe_order(points_q, "created_at", desc=True, nulls_last=True)
            points_q = points_q.range(0, points_limit - 1)

            points_res = points_q.execute()
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


@router.post("/properties/admin/backfill-scores")
def backfill_property_scores(
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

    _require_admin(x_admin_token)

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
def admin_score_stats(x_admin_token: str | None = Header(None)):
    """Admin stats for diagnosing why scoring/backfill does (or doesn't) run."""

    _require_admin(x_admin_token)
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
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10_000),
    x_admin_token: str | None = Header(None),
):
    """Return a small sample of rows to validate scoring in production."""

    _require_admin(x_admin_token)
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
    id: str = Query(..., min_length=1),
    x_admin_token: str | None = Header(None),
):
    """Fetch one property row and compare stored vs computed deal score.

    Useful when production shows `score_breakdown.version=v1.1` but
    inputs indicate `rent_source=missing` unexpectedly.
    """

    _require_admin(x_admin_token)
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

    _require_admin(x_admin_token)
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
