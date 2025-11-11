# backend/routes/import_routes.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple

try:
    from fastapi import APIRouter, HTTPException  # type: ignore
except Exception:  # pragma: no cover
    # Minimal local shims so the module can be imported when fastapi isn't installed.
    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str | None = None):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:
        def __init__(self, *args, **kwargs):
            # Accepts the same constructor signature used in this module.
            pass

        def post(self, *args, **kwargs):
            # Mimic decorator behavior but return the function unchanged.
            def decorator(func):
                return func
            return decorator

from pydantic import BaseModel

# Scrapers (existing)
from ..scraper.rightmove_scraper import scrape_rightmove_properties
from ..scraper.zoopla_scraper import scrape_zoopla_properties
from ..scraper.onthemarket_scraper import scrape_onthemarket_properties
from ..scraper.spare_room_scraper import scrape_spareroom_properties

# Shared Supabase client
try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None  # graceful if local-only


router = APIRouter(prefix="/import", tags=["import"])


class ImportRequest(BaseModel):
    location: str


def _unique_key(p: Dict[str, Any]) -> Tuple[Any, Any, Any]:
    return (p.get("title"), p.get("price"), p.get("location"))


@router.post("/all")
async def import_all(req: ImportRequest):
    """
    Scrape Zoopla + Rightmove + OnTheMarket + SpareRoom for `location`, dedupe, upsert to Supabase.
    Returns { count } and the first few items (preview).
    """
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        zoopla: List[Dict[str, Any]] = scrape_zoopla_properties(loc) or []
        rightmove: List[Dict[str, Any]] = scrape_rightmove_properties(loc) or []
        onthemarket: List[Dict[str, Any]] = scrape_onthemarket_properties(loc) or []
        spareroom: List[Dict[str, Any]] = scrape_spareroom_properties(loc) or []

        combined = zoopla + rightmove + onthemarket + spareroom
        seen, unique_props = set(), []
        for p in combined:
            k = _unique_key(p)
            if k not in seen:
                seen.add(k)
                unique_props.append(p)

        # Optional: upsert if supabase configured
        if sb and unique_props:
            try:
                sb.table("properties").upsert(unique_props).execute()
            except Exception:
                # Don't fail the import if DB write fails
                pass

        preview = unique_props[:10]
        return {"count": len(unique_props), "preview": preview}
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Import failed: {type(e).__name__}")


@router.post("/zoopla")
async def import_zoopla(req: ImportRequest):
    loc = (req.location or "").strip()
    if not loc:
        raise HTTPException(status_code=400, detail="Location is required")

    items = scrape_zoopla_properties(loc) or []
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

    items = scrape_rightmove_properties(loc) or []
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

    items = scrape_onthemarket_properties(loc) or []
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

    items = scrape_spareroom_properties(loc) or []
    if sb and items:
        try:
            sb.table("properties").upsert(items).execute()
        except Exception:
            pass
    return {"count": len(items)}
