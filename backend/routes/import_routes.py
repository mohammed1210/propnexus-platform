# backend/routes/import_routes.py
from __future__ import annotations

import asyncio
import inspect
import logging
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from backend.scraper.utils import TARGET_CITIES

# Scrapers (existing)
from backend.utils.ingest import scrape_all_sources
from backend.utils.scrape_runs import create_scrape_run, finish_scrape_run

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


# In-memory batch job state for /import/batch async mode.
# Note: this is best-effort and not durable across deploys/restarts.
_BATCH_JOBS: dict[str, dict[str, Any]] = {}


def _overall_batch_status(per_city: dict[str, dict[str, Any]]) -> str:
    statuses = [str(v.get("status") or "queued").lower() for v in (per_city or {}).values()]
    if not statuses:
        return "queued"
    if any(s == "running" for s in statuses):
        return "running"
    ok = sum(1 for s in statuses if s == "success")
    err = sum(1 for s in statuses if s == "error")
    if ok == len(statuses):
        return "success"
    if err == len(statuses):
        return "error"
    if ok > 0 and err > 0:
        return "partial"
    return statuses[0]


def _update_batch_job(batch_id: str, patch: dict[str, Any]) -> None:
    job = _BATCH_JOBS.get(batch_id)
    if not isinstance(job, dict):
        return
    job.update(patch)


def _update_city(batch_id: str, city: str, patch: dict[str, Any]) -> None:
    job = _BATCH_JOBS.get(batch_id)
    if not isinstance(job, dict):
        return
    per_city = job.get("per_city")
    if not isinstance(per_city, dict):
        return
    entry = per_city.get(city)
    if not isinstance(entry, dict):
        entry = {}
        per_city[city] = entry
    entry.update(patch)


def _queue_batch_job(
    *,
    batch_id: str,
    cities: list[str],
    max_pages: int,
    delay_min_s: float,
    delay_max_s: float,
    per_city_timeout_s: float,
) -> None:
    async def _runner() -> None:
        _update_batch_job(batch_id, {"status": "running"})

        # Best-effort: reflect on scrape_runs status while job is in flight.
        try:
            if sb:
                sb.table("scrape_runs").update({"status": "running"}).eq("id", batch_id).execute()
        except Exception:
            pass

        total_scraped = 0
        total_imported = 0
        for i, city in enumerate(cities):
            _update_city(batch_id, city, {"status": "running"})
            try:

                async def _do_city() -> tuple[list[Any], int, str | None]:
                    raw = await _maybe_await(
                        scrape_all_sources(
                            city,
                            zoopla_max_pages=max_pages,
                            onthemarket_max_pages=max_pages,
                        )
                    )
                    items_local: list[Any] = raw if isinstance(raw, list) else []

                    imported_local = 0
                    db_error_local: str | None = None
                    if items_local:
                        now_iso = _now_iso()
                        db_rows = [
                            _clean_row(p, now_iso) for p in items_local if isinstance(p, dict)
                        ]
                        ok, db_error_local = _upsert_properties_rows(rows=db_rows)
                        imported_local = len(db_rows) if ok else 0
                    return items_local, imported_local, db_error_local

                items, imported, db_error = await asyncio.wait_for(
                    _do_city(),
                    timeout=max(1.0, float(per_city_timeout_s or 0)),
                )

                scraped = len(items)
                total_scraped += scraped

                db_upsert_ok = db_error is None
                total_imported += int(imported or 0)

                _update_city(
                    batch_id,
                    city,
                    {
                        "scraped": scraped,
                        "imported": imported,
                        "status": "success" if db_upsert_ok else "error",
                        "error": db_error,
                    },
                )
            except asyncio.TimeoutError:
                _update_city(
                    batch_id,
                    city,
                    {
                        "scraped": 0,
                        "imported": 0,
                        "status": "error",
                        "error": f"timeout after {per_city_timeout_s}s",
                    },
                )
            except Exception as e:
                _update_city(
                    batch_id,
                    city,
                    {"scraped": 0, "imported": 0, "status": "error", "error": str(e)},
                )

            if i < len(cities) - 1:
                await asyncio.sleep(random.uniform(delay_min_s, delay_max_s))

        job = _BATCH_JOBS.get(batch_id) or {}
        per_city = job.get("per_city") if isinstance(job, dict) else {}
        overall = _overall_batch_status(per_city if isinstance(per_city, dict) else {})
        _update_batch_job(
            batch_id,
            {
                "status": overall,
                "total_scraped": total_scraped,
                "total_imported": total_imported,
            },
        )

        # Persist final status best-effort.
        try:
            finish_scrape_run(
                run_id=batch_id,
                status=overall,
                count_inserted=total_imported,
                error=None,
            )
        except Exception:
            pass

    asyncio.create_task(_runner())


async def _maybe_await(result: Any) -> Any:
    if inspect.iscoroutine(result) or inspect.isawaitable(result):
        return await result
    return result


async def _scrape_and_upsert(
    *,
    location: str,
    scrape_fn: Any,
    run_id: str | None = None,
    source: str | None = None,
) -> int:
    """Run scrape and upsert results, best-effort.

    Used by the optional `?async=true` mode on /import/* endpoints to avoid request
    timeouts in production.
    """

    if not run_id and source:
        run_id = create_scrape_run(source=source, location=location)

    scrape_error: str | None = None
    try:
        items = await _maybe_await(scrape_fn())
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []

    db_ok = False
    db_error: str | None = None
    inserted = 0
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        inserted = len(db_rows)
        if sb and db_rows:
            try:
                sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
                db_ok = True
            except Exception as e:
                db_error = str(e)

    if run_id:
        if db_ok:
            finish_scrape_run(run_id=run_id, status="success", count_inserted=inserted)
        else:
            finish_scrape_run(
                run_id=run_id,
                status="error",
                count_inserted=0,
                error=(db_error or scrape_error or "unknown"),
            )

    return len(items)


def _queue_scrape_and_upsert(
    *,
    location: str,
    scrape_fn: Any,
    run_id: str | None = None,
    source: str | None = None,
) -> None:
    asyncio.create_task(
        _scrape_and_upsert(location=location, scrape_fn=scrape_fn, run_id=run_id, source=source)
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_junk_image_url(u: Any) -> bool:
    s = (u or "").strip().lower() if isinstance(u, str) else ""
    if not s:
        return True

    # Zoopla static assets / logos / error placeholders
    if "zoopla_static_agent_logo" in s:
        return True
    if "/_next/static/" in s:
        return True
    if "error-image" in s:
        return True

    # OnTheMarket site assets (icons/backgrounds)
    # Keep floorplans (useful in gallery), but drop generic site icons.
    if "onthemarket.com/assets/images/" in s:
        return True
    if "map-pill.png" in s:
        return True

    # Third-party ad/agent product creatives commonly embedded in OTM pages
    if "agentsmutual.co.uk/agent-products/" in s:
        return True

    # SVGs are frequently logos/icons
    if s.endswith(".svg"):
        return True

    return False


def _filter_junk_image_urls(urls: List[str]) -> List[str]:
    """Remove common non-listing images (logos/icons/placeholders).

    Keep this intentionally conservative: only strip URLs that are very likely
    to be site chrome rather than actual listing photos.
    """

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

    # Strip site chrome from image_urls, and prefer a real photo for imageurl.
    if isinstance(row.get("image_urls"), list):
        filtered = _filter_junk_image_urls([u for u in row["image_urls"] if isinstance(u, str)])
        if filtered:
            row["image_urls"] = filtered
            # If imageurl is missing or looks like junk, promote first filtered image.
            current = row.get("imageurl")
            if (not isinstance(current, str)) or _is_junk_image_url(current):
                row["imageurl"] = filtered[0]

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


def _strip_field(rows: list[Dict[str, Any]], field: str) -> list[Dict[str, Any]]:
    cleaned: list[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if field in r:
            nr = dict(r)
            nr.pop(field, None)
            cleaned.append(nr)
        else:
            cleaned.append(r)
    return cleaned


def _upsert_properties_rows(
    *,
    rows: list[Dict[str, Any]],
    on_conflict: str = "source,external_id",
) -> tuple[bool, str | None]:
    """Upsert rows into Supabase with a compatibility retry.

    Production schemas sometimes lag behind code (e.g. missing `last_seen_at`).
    If we detect that specific schema-cache error, retry without the column.
    """
    if not sb:
        return False, "Supabase client not configured (missing SUPABASE_URL/keys)"
    if not rows:
        return False, None

    try:
        sb.table("properties").upsert(rows, on_conflict=on_conflict).execute()
        return True, None
    except Exception as e:
        msg = str(e)
        if "last_seen_at" in msg and ("PGRST204" in msg or "Could not find" in msg):
            try:
                stripped = _strip_field(rows, "last_seen_at")
                sb.table("properties").upsert(stripped, on_conflict=on_conflict).execute()
                return True, None
            except Exception as e2:
                return False, str(e2)
        return False, msg


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

    run_id = create_scrape_run(source="all", location=loc)

    # ✅ Run scrapers
    items = await _maybe_await(scrape_all_sources(loc))
    if not isinstance(items, list):
        items = []

    sources: Dict[str, int] = {
        "rightmove": 0,
        "zoopla": 0,
        "onthemarket": 0,
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
            finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=str(e))
            raise HTTPException(status_code=500, detail=f"DB upsert failed: {e}")

    finish_scrape_run(run_id=run_id, status="success", count_inserted=inserted)

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


class BatchImportRequest(BaseModel):
    cities: List[str] | None = None
    max_pages: int = 1
    delay_min_s: float = 0.5
    delay_max_s: float = 1.5
    run_async: bool = True
    per_city_timeout_s: float = 90.0


@router.post("/zoopla")
async def import_zoopla(
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    # Optionally protect import endpoints in production.
    # If IMPORT_ADMIN_TOKEN is unset, this is a no-op.
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="zoopla", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.zoopla_scraper import scrape_zoopla_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_zoopla_properties(loc, max_pages=max_pages),
                run_id=run_id,
                source="zoopla",
            )
            return {"queued": True, "source": "zoopla", "location": loc}

        items = await _maybe_await(scrape_zoopla_properties(loc, max_pages=max_pages))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"zoopla": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.get("/zoopla")
async def import_zoopla_get(
    location: str = Query(..., description="Location to scrape"),
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    # Keep backwards compatibility with operational curl usage:
    # `GET /import/zoopla?location=London`
    return await import_zoopla(
        ImportRequest(location=location),
        x_admin_token=x_admin_token,
        run_async=run_async,
        max_pages=max_pages,
    )


@router.post("/rightmove")
async def import_rightmove(
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="rightmove", location=loc)
    try:
        from backend.scraper.rightmove_scraper import scrape_rightmove_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_rightmove_properties(loc),
                run_id=run_id,
                source="rightmove",
            )
            return {"queued": True, "source": "rightmove", "location": loc}

        items = await _maybe_await(scrape_rightmove_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    if not sb:
        db_error = "Supabase client not configured (missing SUPABASE_URL/keys)"
    elif items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
            db_upsert_ok = True
        except Exception as e:
            db_error = str(e)

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if db_error:
        payload["db_error"] = db_error

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if db_error else "success",
            count_inserted=0 if db_error else len(items),
            error=db_error,
        )
    warning = _scrape_zero_warning(loc, sources={"rightmove": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/onthemarket")
async def import_onthemarket(
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
    max_pages: int = Query(
        1,
        ge=1,
        le=5,
        description="Max pages to paginate (capped at 5)",
    ),
):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="onthemarket", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.onthemarket_scraper import (
            scrape_onthemarket_properties,  # type: ignore
        )

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_onthemarket_properties(loc, max_pages=max_pages),
                run_id=run_id,
                source="onthemarket",
            )
            return {"queued": True, "source": "onthemarket", "location": loc}

        items = await _maybe_await(scrape_onthemarket_properties(loc, max_pages=max_pages))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"onthemarket": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.post("/batch")
async def import_batch(
    req: BatchImportRequest,
    x_admin_token: str | None = Header(None),
):
    """Batch import across multiple UK cities.

    This is intentionally sequential with small delays to reduce rate-limit risk.
    """

    _require_admin(x_admin_token)

    max_pages = max(1, min(5, int(req.max_pages or 1)))
    delay_min = max(0.0, float(req.delay_min_s))
    delay_max = max(delay_min, float(req.delay_max_s))

    raw_cities = req.cities if req.cities else TARGET_CITIES
    cities: List[str] = []
    seen = set()
    for c in raw_cities:
        s = (c or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        cities.append(s)

    if not cities:
        raise HTTPException(status_code=400, detail="No cities provided")

    # Safety cap: keep the endpoint bounded.
    cities = cities[:25]

    if req.run_async:
        # Use scrape_runs.id as the batch_id so we persist a durable identifier.
        # If Supabase isn't configured, fall back to a UUID.
        batch_id = create_scrape_run(
            source="batch",
            location=f"{len(cities)} cities",
            status="queued",
        )
        if not batch_id:
            batch_id = str(uuid.uuid4())

        _BATCH_JOBS[batch_id] = {
            "batch_id": batch_id,
            "status": "queued",
            "cities": cities,
            "max_pages": max_pages,
            "delay_min_s": delay_min,
            "delay_max_s": delay_max,
            "total_scraped": 0,
            "total_imported": 0,
            "per_city": {c: {"scraped": 0, "imported": 0, "status": "queued"} for c in cities},
        }

        _queue_batch_job(
            batch_id=batch_id,
            cities=cities,
            max_pages=max_pages,
            delay_min_s=delay_min,
            delay_max_s=delay_max,
            per_city_timeout_s=max(1.0, float(req.per_city_timeout_s or 0)),
        )

        return {
            "queued": True,
            "batch_id": batch_id,
            "status_url": f"/import/batch/status/{batch_id}",
        }

    run_id = create_scrape_run(source="batch", location=f"{len(cities)} cities")

    total_items = 0
    total_inserted = 0
    per_city: Dict[str, Dict[str, Any]] = {}
    scrape_error: str | None = None
    db_error: str | None = None

    try:
        for i, city in enumerate(cities):
            items = await _maybe_await(
                scrape_all_sources(
                    city,
                    zoopla_max_pages=max_pages,
                    onthemarket_max_pages=max_pages,
                )
            )
            if not isinstance(items, list):
                items = []

            total_items += len(items)
            inserted = 0
            if items:
                now_iso = _now_iso()
                db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
                ok, e = _upsert_properties_rows(rows=db_rows)
                if ok:
                    inserted = len(db_rows)
                    total_inserted += inserted
                else:
                    db_error = e

            per_city[city] = {
                "count": len(items),
                "inserted": inserted,
            }

            if i < len(cities) - 1:
                await asyncio.sleep(random.uniform(delay_min, delay_max))

    except Exception as e:
        scrape_error = str(e)

    if db_error:
        finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=db_error)
    elif scrape_error:
        finish_scrape_run(run_id=run_id, status="error", count_inserted=0, error=scrape_error)
    else:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=total_inserted)

    payload: Dict[str, Any] = {
        "cities": cities,
        "max_pages": max_pages,
        "total_scraped": total_items,
        "total_imported": total_inserted,
        "per_city": per_city,
    }
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    return payload


@router.post("/spareroom")
async def import_spareroom(
    req: ImportRequest,
    x_admin_token: str | None = Header(None),
    run_async: bool = Query(
        False,
        alias="async",
        description="If true, queue scrape/upsert in background and return immediately",
    ),
):
    _require_admin(x_admin_token)
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    run_id = create_scrape_run(source="spareroom", location=loc)
    scrape_error: str | None = None
    try:
        from backend.scraper.spare_room_scraper import scrape_spareroom_properties  # type: ignore

        if run_async:
            _queue_scrape_and_upsert(
                location=loc,
                scrape_fn=lambda: scrape_spareroom_properties(loc),
                run_id=run_id,
                source="spareroom",
            )
            return {"queued": True, "source": "spareroom", "location": loc}

        items = await _maybe_await(scrape_spareroom_properties(loc))
        if not isinstance(items, list):
            items = []
    except Exception as e:
        scrape_error = str(e)
        items = []
    db_upsert_ok = False
    db_error: str | None = None
    if items:
        now_iso = _now_iso()
        db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
        db_upsert_ok, db_error = _upsert_properties_rows(rows=db_rows)

    if db_upsert_ok:
        finish_scrape_run(run_id=run_id, status="success", count_inserted=len(items))
    else:
        finish_scrape_run(
            run_id=run_id,
            status="error" if (scrape_error or db_error) else "success",
            count_inserted=0 if (scrape_error or db_error) else len(items),
            error=(db_error or scrape_error),
        )

    payload: Dict[str, Any] = {"count": len(items), "db_upsert_ok": db_upsert_ok}
    if scrape_error:
        payload["scrape_error"] = scrape_error
    if db_error:
        payload["db_error"] = db_error
    warning = _scrape_zero_warning(loc, sources={"spareroom": len(items)})
    if warning:
        payload["warning"] = warning
    return payload


@router.get("/batch/status/{batch_id}")
async def import_batch_status(
    batch_id: str,
    x_admin_token: str | None = Header(None),
):
    _require_admin(x_admin_token)

    job = _BATCH_JOBS.get(batch_id)
    if isinstance(job, dict):
        per_city = job.get("per_city") if isinstance(job.get("per_city"), dict) else {}
        overall = _overall_batch_status(per_city)
        job["status"] = overall
        return {
            "batch_id": batch_id,
            "status": overall,
            "cities": job.get("cities") or [],
            "max_pages": job.get("max_pages") or 1,
            "total_scraped": job.get("total_scraped") or 0,
            "total_imported": job.get("total_imported") or 0,
            "per_city": per_city,
            "error": job.get("error"),
        }

    # Fallback: if Supabase is configured, return scrape_runs status even if in-memory state was lost.
    try:
        if sb:
            res = (
                sb.table("scrape_runs")
                .select("id,status,count_inserted,error")
                .eq("id", batch_id)
                .execute()
            )
            data = getattr(res, "data", None)
            if isinstance(data, list) and data:
                row = data[0]
                return {
                    "batch_id": batch_id,
                    "status": (row.get("status") or "unknown"),
                    "total_imported": int(row.get("count_inserted") or 0),
                    "per_city": {},
                    "error": row.get("error"),
                }
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Unknown batch_id")


# ---------------- backwards-compatible alias ----------------


_import_router = router
router = admin_alias_router


@router.post("/admin/import-all")
async def admin_import_all(req: str, x_admin_token: str = Header(None)):
    return await import_all(req=req, x_admin_token=x_admin_token)


router = _import_router
