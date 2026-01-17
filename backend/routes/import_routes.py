# backend/routes/import_routes.py
from __future__ import annotations

import inspect
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, HTTPException, Query, Request
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


def _require_admin(request: Request) -> None:
    """
    Optional protection:
    If IMPORT_ADMIN_TOKEN is set, require header X-Admin-Token to match.
    If not set, endpoint is open (UI button is still admin-only).
    """
    token = (os.getenv("IMPORT_ADMIN_TOKEN") or "").strip()
    if not token:
        return

    got = (request.headers.get("x-admin-token") or "").strip()
    if not got or got != token:
        raise HTTPException(status_code=401, detail="Admin token required")


@router.post("/all")
async def import_all(
    request: Request,
    req: str | None = Query(None, description="Location e.g. London"),
):
    _require_admin(request)

    # 1) Prefer query param
    loc = (req or "").strip()

    # 2) Backwards compatible: accept JSON body {"location":"..."}
    if not loc:
        try:
            payload = await request.json()  # type: ignore[attr-defined]
        except Exception:
            payload = {}
        loc = str(payload.get("location") or "").strip()

    if not loc:
        raise HTTPException(
            status_code=422,
            detail="Missing location. Use ?req=London or JSON body {'location':'London'}",
        )

    # ✅ Run scrapers
    items = await _maybe_await(scrape_all_sources(loc))
    if not isinstance(items, list):
        items = []

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

    # Return small preview only (avoid huge payloads)
    preview = db_rows[:10]
    return {"count": inserted, "preview": preview, "location": loc}


# ---------------- existing endpoints kept as-is ----------------


class ImportRequest(BaseModel):
    location: str


@router.post("/zoopla")
async def import_zoopla(req: ImportRequest):
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    items = [
        p for p in (await _maybe_await(scrape_all_sources(loc))) if (p.get("source") == "zoopla")
    ]
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    return {"count": len(items)}


@router.post("/rightmove")
async def import_rightmove(req: ImportRequest):
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    items = [
        p for p in (await _maybe_await(scrape_all_sources(loc))) if (p.get("source") == "rightmove")
    ]
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    return {"count": len(items)}


@router.post("/onthemarket")
async def import_onthemarket(req: ImportRequest):
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    items = [
        p
        for p in (await _maybe_await(scrape_all_sources(loc)))
        if (p.get("source") == "onthemarket")
    ]
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    return {"count": len(items)}


@router.post("/spareroom")
async def import_spareroom(req: ImportRequest):
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    items = [
        p for p in (await _maybe_await(scrape_all_sources(loc))) if (p.get("source") == "spareroom")
    ]
    if sb and items:
        try:
            now_iso = _now_iso()
            db_rows = [_clean_row(p, now_iso) for p in items if isinstance(p, dict)]
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    return {"count": len(items)}
