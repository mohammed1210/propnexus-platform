from __future__ import annotations

import os
import re
from typing import Any, Dict, List

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

try:
    from backend.db import sb  # type: ignore
except Exception:
    sb = None

router = APIRouter(tags=["waitlist"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _require_admin(x_admin_token: str | None = None) -> None:
    required = os.getenv("IMPORT_ADMIN_TOKEN")
    if required and x_admin_token != required:
        raise HTTPException(status_code=401, detail="Admin token required")


class WaitlistRequest(BaseModel):
    email: str
    name: str | None = None
    source_page: str | None = None


@router.post("/waitlist")
def post_waitlist(req: WaitlistRequest):
    email = (req.email or "").strip().lower()
    if not email or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Invalid email")

    if not sb:
        raise HTTPException(status_code=503, detail="Supabase client not configured")

    row: Dict[str, Any] = {
        "email": email,
        "name": (req.name or "").strip() or None,
        "source_page": (req.source_page or "").strip() or None,
    }

    try:
        sb.table("waitlist").upsert(row, on_conflict="email").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upsert waitlist: {e}")

    return {"ok": True}


@admin_router.get("/waitlist")
def get_waitlist(
    limit: int = Query(50, ge=1, le=500),
    x_admin_token: str | None = Header(None),
):
    _require_admin(x_admin_token)

    if not sb:
        raise HTTPException(status_code=503, detail="Supabase client not configured")

    try:
        resp = (
            sb.table("waitlist")
            .select("id,email,name,source_page,created_at")
            .order("created_at", desc=True)
            .limit(int(limit))
            .execute()
        )
        rows: List[Dict[str, Any]] = list(getattr(resp, "data", []) or [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch waitlist: {e}")

    return rows
