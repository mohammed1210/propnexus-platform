"""API routes for managing property notes and annotations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.utils.supabase_client import get_supabase
from supabase import Client

router = APIRouter(prefix="/notes", tags=["notes"])

_sb: Client | None = None


def _get_supabase() -> Client:
    """
    Lazily create (and cache) the Supabase client.
    This avoids import-time crashes in CI when env vars are not present.
    """
    global _sb
    if _sb is None:
        try:
            sb = get_supabase(required=True)
        except Exception:
            # Don’t crash import-time in CI; raise a clear runtime error instead.
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and one of "
                "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY / SUPABASE_KEY."
            )

        # `get_supabase(required=True)` should never return None.
        _sb = sb  # type: ignore[assignment]
    return _sb


class NotesPayload(BaseModel):
    property_id: str
    user_id: Optional[str] = None  # keep None for now if you don't have auth
    custom_field: Optional[str] = ""
    notes: Optional[str] = ""


@router.get("/{property_id}")
def get_notes(property_id: str, user_id: Optional[str] = None):
    """Fetch notes for a property (optionally per user)."""
    try:
        sb = _get_supabase()
    except RuntimeError as e:
        # Surface as HTTP 503 instead of exploding the import/test phases.
        raise HTTPException(status_code=503, detail=str(e))

    uid = user_id or ""  # normalise null user to empty string
    resp = (
        sb.table("notes")
        .select("*")
        .eq("property_id", property_id)
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    data = (
        resp.data[0]
        if resp.data
        else {
            "property_id": property_id,
            "user_id": uid,
            "custom_field": "",
            "notes": "",
            "updated_at": None,
        }
    )
    return data


@router.post("")
def upsert_notes(payload: NotesPayload):
    """Create/update notes for (user_id, property_id)."""
    try:
        sb = _get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    row = {
        "property_id": payload.property_id,
        "user_id": payload.user_id or "",
        "custom_field": payload.custom_field or "",
        "notes": payload.notes or "",
        "updated_at": datetime.utcnow().isoformat(),
    }

    # upsert on the composite key
    resp = sb.table("notes").upsert(row, on_conflict="user_id,property_id").execute()
    if resp.error:
        raise HTTPException(status_code=500, detail=str(resp.error))
    return {"ok": True}
