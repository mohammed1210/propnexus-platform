from __future__ import annotations
import logging
import os
from typing import Any, Dict, List

try:
    from fastapi import APIRouter, HTTPException  # type: ignore
except Exception:  # pragma: no cover

    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str | None = None):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:  # minimal shim
        def __init__(self, *_, **__):
            pass

        def post(self, *_a, **_kw):
            def deco(func):
                return func

            return deco


try:
    from pydantic import BaseModel  # type: ignore
except Exception:  # pragma: no cover

    class BaseModel:  # minimal stub
        def __init__(self, **data):
            for k, v in data.items():
                setattr(self, k, v)


try:  # Supabase optional on local dev
    from supabase import Client, create_client  # type: ignore
except Exception:  # pragma: no cover
    Client = object  # type: ignore

    def create_client(*_a: object, **_kw: object) -> object:  # type: ignore
        raise RuntimeError("Supabase SDK not available")


from utils.ingest import scrape_all_sources

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)  # type: ignore
    except Exception as e:  # pragma: no cover
        logging.warning("Supabase init failed: %s", e)

router = APIRouter()


class ScrapeRequest(BaseModel):
    location: str


def _chunk(items: List[Dict[str, Any]], size: int = 100) -> List[List[Dict[str, Any]]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


@router.post("/scrape")
async def scrape_endpoint(req: ScrapeRequest):
    """DEPRECATED: Use /import/all instead.

    This endpoint is maintained for backwards compatibility but will be removed
    in a future version. Please migrate to /import/all which provides the same
    functionality with better error handling and logging.

    Aggregate scrape of all sources -> normalized -> upsert -> return preview.

    Returns JSON: { count, preview }
    """
    logging.warning("DEPRECATED: /scrape endpoint called, use /import/all instead")

    location = (req.location or "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        normalized = await scrape_all_sources(location)
        count = len(normalized)

        # Upsert in chunks (if Supabase configured)
        if supabase and normalized:
            for batch in _chunk(normalized):
                try:
                    # Rely on unique constraint on external_id
                    supabase.table("properties").upsert(batch).execute()
                except Exception as db_err:  # pragma: no cover
                    logging.warning("properties upsert failed: %s", db_err)
                    # Continue other batches rather than failing entirely

        preview = normalized[:10]
        return {"count": count, "preview": preview}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        logging.exception("Unified scrape failed: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Scraping failed")
