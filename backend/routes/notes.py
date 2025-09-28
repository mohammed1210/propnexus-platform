# backend/routes/notes.py
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from supabase import Client, create_client

router = APIRouter(prefix="/notes", tags=["notes"])

# --- Supabase client (server-only key) ----------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = (
    os.getenv("SUPABASE_SERVICE_ROLE")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)


# --- Models --------------------------------------------------------------------
class NotesRecord(BaseModel):
    id: Optional[str] = None
    property_id: str
    user_id: str = ""
    custom_field: str = ""
    notes: str = ""
    updated_at: Optional[str] = None


class NotesPayload(BaseModel):
    property_id: str = Field(..., description="Property identifier")
    user_id: Optional[str] = Field(default=None, description="User id (optional)")
    custom_field: Optional[str] = Field(default="", description="Custom free text")
    notes: Optional[str] = Field(default="", description="Notes content")


class NotesPatchPayload(BaseModel):
    custom_field: Optional[str] = None
    notes: Optional[str] = None


# --- Helpers -------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_user(user_id: Optional[str]) -> str:
    return user_id or ""


def _default_record(property_id: str, user_id: str) -> NotesRecord:
    return NotesRecord(
        property_id=property_id,
        user_id=user_id,
        custom_field="",
        notes="",
        updated_at=None,
    )


def _raise_if_error(resp) -> None:
    if getattr(resp, "error", None):
        raise HTTPException(status_code=500, detail=str(resp.error))


# --- Routes --------------------------------------------------------------------
@router.get(
    "/{property_id}",
    response_model=NotesRecord,
    summary="Fetch notes for a property (optionally per user).",
)
def get_notes(property_id: str, user_id: Optional[str] = Query(default=None)):
    uid = _norm_user(user_id)
    resp = (
        sb.table("notes")
        .select("*")
        .eq("property_id", property_id)
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    _raise_if_error(resp)

    if resp.data:
        return NotesRecord(**resp.data[0])

    return _default_record(property_id, uid)


@router.get(
    "",
    response_model=List[NotesRecord],
    summary="List all notes for a user_id.",
)
def list_notes(user_id: Optional[str] = Query(default=None)):
    uid = _norm_user(user_id)
    resp = sb.table("notes").select("*").eq("user_id", uid).execute()
    _raise_if_error(resp)
    return [NotesRecord(**row) for row in (resp.data or [])]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=Dict[str, Literal[True]],
    summary="Create/update notes for (user_id, property_id).",
)
def upsert_notes(payload: NotesPayload):
    row = {
        "property_id": payload.property_id,
        "user_id": _norm_user(payload.user_id),
        "custom_field": payload.custom_field or "",
        "notes": payload.notes or "",
        "updated_at": _now_iso(),
    }
    resp = sb.table("notes").upsert(row, on_conflict="user_id,property_id").execute()
    _raise_if_error(resp)
    return {"ok": True}


@router.patch(
    "/{property_id}",
    response_model=Dict[str, Literal[True]],
    summary="Patch notes/custom_field for (user_id, property_id).",
)
def patch_notes(
    property_id: str,
    body: NotesPatchPayload,
    user_id: Optional[str] = Query(default=None),
):
    uid = _norm_user(user_id)

    updates: Dict[str, Any] = {}
    if body.custom_field is not None:
        updates["custom_field"] = body.custom_field
    if body.notes is not None:
        updates["notes"] = body.notes

    if not updates:
        return {"ok": True}

    updates["updated_at"] = _now_iso()

    resp = (
        sb.table("notes")
        .update(updates)
        .eq("property_id", property_id)
        .eq("user_id", uid)
        .select("*")
        .execute()
    )
    _raise_if_error(resp)

    if resp.data and len(resp.data) > 0:
        return {"ok": True}

    base = {
        "property_id": property_id,
        "user_id": uid,
        "custom_field": updates.get("custom_field", ""),
        "notes": updates.get("notes", ""),
        "updated_at": updates["updated_at"],
    }
    resp2 = sb.table("notes").upsert(base, on_conflict="user_id,property_id").execute()
    _raise_if_error(resp2)
    return {"ok": True}


@router.delete(
    "/{property_id}",
    response_model=Dict[str, Literal[True]],
    summary="Delete notes for (user_id, property_id).",
)
def delete_notes(property_id: str, user_id: Optional[str] = Query(default=None)):
    uid = _norm_user(user_id)
    resp = (
        sb.table("notes")
        .delete()
        .eq("property_id", property_id)
        .eq("user_id", uid)
        .execute()
    )
    _raise_if_error(resp)
    return {"ok": True}
