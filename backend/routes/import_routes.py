# backend/routes/import_routes.py
from __future__ import annotations

import inspect
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

# Scrapers (existing)
from backend.utils.ingest import scrape_all_sources

# Shared Supabase client
try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None  # graceful if local-only

# Rate limiting (optional)
try:
    from backend.middleware.rate_limit import limiter
except Exception:
    limiter = None  # graceful if not available


router = APIRouter(prefix="/import", tags=["import"])

# Backwards-compatible alias router (no prefix)
admin_alias_router = APIRouter(tags=["import"])


async def _maybe_await(result: Any) -> Any:
    if inspect.iscoroutine(result) or inspect.isawaitable(result):
        return await result
    return result


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_row(p: Dict[str, Any], now_iso: str) -> Dict[str, Any]:
    """
    Normalise a scraped property dict into something safe to upsert.
    - Adds last_seen_at
    - Removes fields not in DB schema (like ai_ready)
    - Leaves everything else intact
    """
    row = dict(p)
    row["last_seen_at"] = now_iso
    row.pop("ai_ready", None)

    def _norm_url(v: Any) -> Any:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if s.startswith("//"):
            return f"https:{s}"
        return s

    def _coerce_int(v: Any) -> int | None:
        if v is None:
            return None
        if isinstance(v, bool):
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
        if v is None:
            return None
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v.strip())
            except Exception:
                return None
        return None

    # Optional hydration from `data.raw` when top-level fields are missing.
    data_obj = row.get("data")
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

    # Map scraper field names into DB schema.
    if not row.get("imageurl"):
        row["imageurl"] = (
            row.get("image_url")
            or row.get("imageUrl")
            or _pick_raw(["imageurl", "image_url", "imageUrl", "image", "imageUrlLarge"])
        )
    row["imageurl"] = _norm_url(row.get("imageurl"))
    row.pop("image_url", None)
    row.pop("imageUrl", None)

    if isinstance(row.get("image_urls"), list):
        row["image_urls"] = [
            _norm_url(u) for u in row.get("image_urls") if isinstance(u, str) and u.strip()
        ]
    elif not row.get("image_urls"):
        raw_imgs = _pick_raw(["image_urls", "imageUrls", "images"])
        if isinstance(raw_imgs, list):
            row["image_urls"] = [_norm_url(u) for u in raw_imgs if isinstance(u, str) and u.strip()]

    if not row.get("location"):
        row["location"] = _pick_raw(["location", "displayAddress", "display_address"])
    if not row.get("address"):
        row["address"] = _pick_raw(["address", "displayAddress", "display_address", "location"])

    if row.get("price") in (None, 0, 0.0, ""):
        raw_price = _pick_raw(["price", "displayPrice", "display_price"])
        row["price"] = _coerce_int(raw_price) if raw_price is not None else row.get("price")

    if row.get("bedrooms") in (None, 0, ""):
        raw_beds = _pick_raw(["bedrooms", "beds", "numBedrooms", "numberOfBedrooms"])
        beds = _coerce_int(raw_beds)
        if beds is not None and beds > 0:
            row["bedrooms"] = beds

    if row.get("bathrooms") in (None, 0, ""):
        raw_baths = _pick_raw(["bathrooms", "baths", "numBathrooms", "numberOfBathrooms"])
        baths = _coerce_int(raw_baths)
        if baths is not None and baths > 0:
            row["bathrooms"] = baths

    if row.get("latitude") in (None, 0, 0.0, ""):
        lat = _coerce_float(_pick_raw(["latitude", "lat"]))
        if lat is not None and lat != 0.0:
            row["latitude"] = lat

    if row.get("longitude") in (None, 0, 0.0, ""):
        lng = _coerce_float(_pick_raw(["longitude", "lng", "lon"]))
        if lng is not None and lng != 0.0:
            row["longitude"] = lng

    # DB schema uses `url` (see supabase/schema.sql). Scrapers/normalizers may
    # emit `listing_url` or `raw_url`; map those into `url` and drop the alias
    # to avoid PostgREST "column does not exist" failures.
    if not row.get("url"):
        row["url"] = row.get("listing_url") or row.get("raw_url")
    row.pop("listing_url", None)
    row.pop("raw_url", None)

    return row


def _dedupe(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Dedupe across sources by (source, external_id) if available,
    otherwise by (title, price, location).
    """
    seen: set[Tuple[Any, Any, Any]] = set()
    out: List[Dict[str, Any]] = []

    for p in items:
        source = p.get("source")
        ext_id = p.get("external_id")

        if source and ext_id:
            key = ("sid", source, ext_id)
        else:
            key = ("tpl", p.get("title"), p.get("price"), p.get("location"))

        if key in seen:
            continue
        seen.add(key)
        out.append(p)

    return out


def _require_admin(x_admin_token: str | None = None) -> None:
    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if required and x_admin_token != required:
        raise HTTPException(status_code=401, detail="Admin token required")


def _scrape_zero_warning(location: str, sources: Dict[str, int] | None = None) -> str | None:
    """Return a human-readable warning when scrapers return 0 results.

    This is intentionally heuristic: production datacenter IPs are often blocked by
    listing sites. If no proxy (ScraperAPI) and no browser rendering is enabled,
    returning 0 with no explanation is confusing.
    """

    loc = (location or "").strip()
    if not loc:
        return None

    # Only warn if everything is 0 (or unknown)
    if sources and any(v > 0 for v in sources.values()):
        return None

    scraper_mode = (os.getenv("SCRAPER_MODE") or "direct").strip().lower()
    has_scraperapi = bool((os.getenv("SCRAPERAPI_KEY") or "").strip())
    playwright_enabled = (os.getenv("PLAYWRIGHT_ENABLE") or "0") == "1"

    if has_scraperapi:
        # Even with ScraperAPI configured, some locations can legitimately yield 0.
        return None

    # No ScraperAPI key. If Playwright is also off, the most likely reason is blocking.
    if (scraper_mode in ("direct", "smart")) and not playwright_enabled:
        return (
            "Scrape returned 0. Likely blocked from this network (common on Railway/VPS IPs). "
            "Set SCRAPERAPI_KEY and use SCRAPER_MODE=scraperapi (or smart), "
            "or enable PLAYWRIGHT_ENABLE=1 with Playwright browsers installed."
        )

    return None


@router.post("/all")
async def import_all(
    req: str | None = Query(None, description="Location e.g. London"),
    x_admin_token: str | None = Header(None),
):
    _require_admin(x_admin_token)

    # Prefer query param
    loc = (req or "").strip()

    if not loc:
        raise HTTPException(
            status_code=422,
            detail="Missing location. Use ?req=London or JSON body {'location':'London'}",
        )

    # ✅ Run scrapers
    items = await _maybe_await(scrape_all_sources(loc))
    if not isinstance(items, list):
        items = []

    sources: Dict[str, int] = {
        "rightmove": 0,
        "zoopla": 0,
        "onthemarket": 0,
        "spareroom": 0,
    }
    for p in items:
        if isinstance(p, dict):
            src = str(p.get("source") or "").strip()
            if src in sources:
                sources[src] += 1

    # ✅ Add last_seen_at, remove non-db fields
    now_iso = datetime.now(timezone.utc).isoformat()
    db_rows = []
    for p in items:
        if not isinstance(p, dict):
            continue
        db_rows.append(_clean_row(p, now_iso))

    # ✅ Upsert into Supabase
    inserted = 0
    if sb and db_rows:
        try:
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
            inserted = len(db_rows)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DB upsert failed: {e}")

    if inserted == 0:
        logging.info("Import completed with 0 properties for location=%s", loc)

    warning = _scrape_zero_warning(loc, sources=sources)
    payload = {
        "location": loc,
        "total_imported": inserted,
        "sources": sources,
    }
    if warning:
        payload["warning"] = warning
    return payload


# ---------------- existing endpoints kept as-is ----------------


class ImportRequest(BaseModel):
    location: str


@router.post("/zoopla")
async def import_zoopla(req: ImportRequest, x_admin_token: str | None = Header(None)):
    # Optionally protect import endpoints in production.
    # If IMPORT_ADMIN_TOKEN is unset, this is a no-op.
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    try:
        from backend.scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore

        items = await _maybe_await(scrape_zoopla_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    payload = {"count": len(items)}
    warning = _scrape_zero_warning(loc, sources={"zoopla": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/rightmove")
async def import_rightmove(req: ImportRequest, x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    try:
        from backend.scraper.rightmove_scraper import scrape_rightmove_properties  # type: ignore

        items = await _maybe_await(scrape_rightmove_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    payload = {"count": len(items)}
    warning = _scrape_zero_warning(loc, sources={"rightmove": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/onthemarket")
async def import_onthemarket(req: ImportRequest, x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    try:
        from backend.scraper.onthemarket_scraper import (
            scrape_onthemarket_properties,  # type: ignore
        )

        items = await _maybe_await(scrape_onthemarket_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    payload = {"count": len(items)}
    warning = _scrape_zero_warning(loc, sources={"onthemarket": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/spareroom")
async def import_spareroom(req: ImportRequest, x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    try:
        from backend.scraper.spare_room_scraper import scrape_spareroom_properties  # type: ignore

        items = await _maybe_await(scrape_spareroom_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    payload = {"count": len(items)}
    warning = _scrape_zero_warning(loc, sources={"spareroom": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


# ---------------- backwards-compatible alias ----------------


_import_router = router
router = admin_alias_router


@router.post("/admin/import-all")
async def admin_import_all(req: str, x_admin_token: str = Header(None)):
    return await import_all(req=req, x_admin_token=x_admin_token)


router = _import_router
