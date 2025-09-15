# backend/routes/notes.py
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

router = APIRouter(prefix="/notes", tags=["notes"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)


class NotesPayload(BaseModel):
    property_id: str
    user_id: Optional[str] = None  # keep None for now if you don't have auth
    custom_field: Optional[str] = ""
    notes: Optional[str] = ""


@router.get("/{property_id}")
def get_notes(property_id: str, user_id: Optional[str] = None):
    """Fetch notes for a property (optionally per user)."""
    uid = user_id or ""  # we normalise null user to empty string
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
