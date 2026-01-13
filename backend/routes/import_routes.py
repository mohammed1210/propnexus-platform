# backend/routes/import_routes.py
from __future__ import annotations

import inspect
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

try:
    from fastapi import APIRouter, HTTPException, Query, Request  # type: ignore
except Exception:  # pragma: no cover

    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str | None = None):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:  # minimal shim
        def __init__(self, *_a, **_kw):
            pass

        def post(self, *_a, **_kw):
            def deco(func):
                return func

            return deco

    class Request:  # minimal shim
        pass

    def Query(*_a: object, **_kw: object) -> object:  # type: ignore
        return None


try:
    from pydantic import BaseModel  # type: ignore
except Exception:  # pragma: no cover

    class BaseModel:  # minimal stub
        def __init__(self, **data):
            for k, v in data.items():
                setattr(self, k, v)


# Scrapers (existing)
from backend.utils.ingest import scrape_all_sources

# Shared Supabase client
try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None  # graceful if local-only

# Rate limiting
try:
    from backend.middleware.rate_limit import limiter
except Exception:
    limiter = None  # graceful if not available


router = APIRouter(prefix="/import", tags=["import"])


async def _maybe_await(result: Any) -> Any:
    """
    Helper to handle both sync and async scraper functions.
    If the result is an awaitable/coroutine, await it.
    Otherwise, return it directly.
    """
    if inspect.iscoroutine(result) or inspect.isawaitable(result):
        return await result
    return result


class ImportRequest(BaseModel):
    location: str


def _unique_key(p: Dict[str, Any]) -> Tuple[Any, Any, Any]:
    return (p.get("title"), p.get("price"), p.get("location"))


@router.post("/all")
async def import_all(
    request: Request,
    req: str | None = Query(None, description="Location e.g. London"),
):
    # 1) Prefer query param
    loc = (req or "").strip()

    # 2) Backwards compatible: accept JSON body {"location":"..."} WITHOUT typing it
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

    # TODO: call your scraper/import service here
    # result = await run_import_all(loc)
    # return result

    return {"count": 0, "preview": [], "location": loc}


@router.post("/zoopla")
async def import_zoopla(req: ImportRequest):
    # Backward compatibility: reuse aggregate and filter client-side
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")
    items = [
        p for p in (await _maybe_await(scrape_all_sources(loc))) if (p.get("source") == "zoopla")
    ]
    if sb and items:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            for p in items:
                if isinstance(p, dict):
                    p["last_seen_at"] = now_iso

            db_rows = []
            for p in items:
                if isinstance(p, dict):
                    row = dict(p)
                    row.pop("ai_ready", None)
                    db_rows.append(row)
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
            now_iso = datetime.now(timezone.utc).isoformat()
            for p in items:
                if isinstance(p, dict):
                    p["last_seen_at"] = now_iso

            db_rows = []
            for p in items:
                if isinstance(p, dict):
                    row = dict(p)
                    row.pop("ai_ready", None)
                    db_rows.append(row)
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
            now_iso = datetime.now(timezone.utc).isoformat()
            for p in items:
                if isinstance(p, dict):
                    p["last_seen_at"] = now_iso

            db_rows = []
            for p in items:
                if isinstance(p, dict):
                    row = dict(p)
                    row.pop("ai_ready", None)
                    db_rows.append(row)
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
            now_iso = datetime.now(timezone.utc).isoformat()
            for p in items:
                if isinstance(p, dict):
                    p["last_seen_at"] = now_iso

            db_rows = []
            for p in items:
                if isinstance(p, dict):
                    row = dict(p)
                    row.pop("ai_ready", None)
                    db_rows.append(row)
            sb.table("properties").upsert(db_rows, on_conflict="source,external_id").execute()
        except Exception:
            pass
    return {"count": len(items)}
