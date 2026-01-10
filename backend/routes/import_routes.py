# backend/routes/import_routes.py
from __future__ import annotations

import inspect
from typing import Any, Dict, Tuple

try:
    from fastapi import APIRouter, HTTPException, Request  # type: ignore
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
@limiter.limit("5/minute") if limiter else lambda f: f
async def import_all(req: ImportRequest, request: Request):
    """
    Scrape Zoopla + Rightmove + OnTheMarket + SpareRoom for `location`, dedupe, upsert to Supabase.
    Returns { count } and the first few items (preview).
    """
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        normalized = await _maybe_await(scrape_all_sources(loc))
        if sb and normalized:
            try:
                sb.table("properties").upsert(normalized).execute()
            except Exception:
                # Do not fail the import if DB write fails
                pass

        preview = normalized[:10]
        return {"count": len(normalized), "preview": preview}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Import failed: {type(e).__name__}")


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
            sb.table("properties").upsert(items).execute()
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
            sb.table("properties").upsert(items).execute()
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
            sb.table("properties").upsert(items).execute()
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
            sb.table("properties").upsert(items).execute()
        except Exception:
            pass
    return {"count": len(items)}
