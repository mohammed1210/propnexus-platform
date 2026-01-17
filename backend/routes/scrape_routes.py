from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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


SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)  # type: ignore
    except Exception as e:  # pragma: no cover
        logging.warning("Supabase init failed: %s", e)

router = APIRouter()


class ScrapeRequest(BaseModel):
    location: str


def _chunk(items: List[Dict[str, Any]], size: int = 100) -> List[List[Dict[str, Any]]]:
    if size <= 0:
        size = 100
    return [items[i : i + size] for i in range(0, len(items), size)]


@router.post("/scrape")
async def scrape_endpoint(req: ScrapeRequest):
    """DEPRECATED: Use /import/all instead.

    Aggregate scrape of all sources -> normalized -> upsert -> return preview.

    Returns JSON: { count, preview }
    """
    logging.warning("DEPRECATED: /scrape endpoint called, use /import/all instead")

    location = (getattr(req, "location", "") or "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        # Lazy import to avoid module-import crashes in CI if scrape code changes
        from backend.utils.ingest import scrape_all_sources  # type: ignore

        normalized = await scrape_all_sources(location)
        count = len(normalized)

        now_iso = datetime.now(timezone.utc).isoformat()
        for p in normalized:
            if isinstance(p, dict):
                p["last_seen_at"] = now_iso

        # Safeguard: keep ai_ready for internal logic/preview, but don't send it to DB.
        db_rows: List[Dict[str, Any]] = []
        for p in normalized:
            if isinstance(p, dict):
                row = dict(p)
                row.pop("ai_ready", None)

                # DB schema uses `url`; scrapers may emit `listing_url`/`raw_url`.
                if not row.get("url"):
                    row["url"] = row.get("listing_url") or row.get("raw_url")
                row.pop("listing_url", None)
                row.pop("raw_url", None)

                db_rows.append(row)

        # Upsert in chunks (if Supabase configured)
        if supabase and db_rows:
            total_written = 0
            total_failed = 0

            for batch in _chunk(db_rows, size=100):
                if not batch:
                    continue

                # Attempt 1: upsert with preferred conflict key
                try:
                    supabase.table("properties").upsert(  # type: ignore
                        batch, on_conflict="source,external_id"
                    ).execute()
                    total_written += len(batch)
                    continue
                except Exception as db_err:  # pragma: no cover
                    logging.warning("properties upsert (source,external_id) failed: %s", db_err)

                # Attempt 2: plain upsert (lets PostgREST choose PK/constraints)
                try:
                    supabase.table("properties").upsert(batch).execute()  # type: ignore
                    total_written += len(batch)
                    continue
                except Exception as db_err2:  # pragma: no cover
                    logging.warning("properties fallback upsert failed: %s", db_err2)

                # Attempt 3: insert best-effort (may create duplicates if no constraints)
                try:
                    supabase.table("properties").insert(batch).execute()  # type: ignore
                    total_written += len(batch)
                    continue
                except Exception as db_err3:  # pragma: no cover
                    logging.warning("properties insert fallback failed: %s", db_err3)
                    total_failed += len(batch)

            logging.info("Scrape DB write summary: ok=%s failed=%s", total_written, total_failed)

        preview = normalized[:10]
        return {"count": count, "preview": preview}

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        logging.exception("Unified scrape failed: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Scraping failed")
