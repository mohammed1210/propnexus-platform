from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from fastapi import APIRouter, Header, HTTPException, Query

try:
    from backend.db import sb  # type: ignore
except Exception:  # pragma: no cover
    sb = None


router = APIRouter(tags=["debug"])


def _require_admin(x_admin_token: str | None = None) -> None:
    """Protect sensitive debug endpoints when IMPORT_ADMIN_TOKEN is configured."""

    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if required and x_admin_token != required:
        raise HTTPException(status_code=401, detail="Admin token required")


def _image_count(value: Any) -> int:
    """Best-effort length for `image_urls`.

    Supabase/PostgREST typically returns JSON arrays as Python lists.
    In some environments it may come back as a JSON string.
    """

    if value is None:
        return 0
    if isinstance(value, list):
        return len([u for u in value if u])
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return 0
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return len([u for u in parsed if u])
        except Exception:
            return 0
    return 0


@router.get("/debug/properties-count")
def properties_count():
    """Debug endpoint to confirm Supabase has `properties` rows."""

    if not sb:
        return {"count": 0}

    res = sb.table("properties").select("id", count="exact").limit(1).execute()
    return {"count": getattr(res, "count", None)}


@router.get("/debug/properties-with-multiple-images")
def properties_with_multiple_images(
    limit: int = Query(10, ge=1, le=50),
    x_admin_token: str | None = Header(None),
):
    """Proof endpoint: return properties that have multiple image URLs.

    Returns a list of objects containing:
      - id
      - source
      - image_count
    """

    _require_admin(x_admin_token)

    if not sb:
        return {"items": []}

    scan_limit = min(2000, max(200, limit * 50))

    query = sb.table("properties").select("id,source,image_urls").limit(scan_limit)
    # Best-effort filter: only rows where image_urls IS NOT NULL.
    try:
        query = query.not_.is_("image_urls", "null")
    except Exception:
        try:
            query = query.neq("image_urls", None)
        except Exception:
            pass

    res = query.execute()
    rows = getattr(res, "data", None) or []

    items: List[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        c = _image_count(r.get("image_urls"))
        if c >= 2:
            items.append({"id": r.get("id"), "source": r.get("source"), "image_count": c})

    items.sort(key=lambda x: int(x.get("image_count") or 0), reverse=True)
    return {"items": items[:limit]}
