# backend/routes/save_deal.py
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, status

from supabase import Client, create_client

load_dotenv()

router = APIRouter()

# Prefer service role key so the API can write server-side
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def _require_supabase() -> Client:
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured on the server",
        )
    return supabase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/save-deal")
async def save_deal(request: Request) -> Dict[str, Any]:
    """
    Insert one saved deal.
    Frontend can post minimal payload like {"property_id": "..."} or a richer record.
    """
    sb = _require_supabase()
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Body must be a JSON object")

        # Ensure a timestamp
        payload.setdefault("saved_at", _now_iso())

        res = sb.table("saved_deals").insert(payload).select("*").execute()
        return {"message": "Deal saved", "data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals")
async def list_saved_deals() -> Dict[str, Any]:
    """Return all saved deals (newest first)."""
    sb = _require_supabase()
    try:
        res = sb.table("saved_deals").select("*").order("saved_at", desc=True).execute()
        return {"data": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals/{deal_id}")
async def get_saved_deal(deal_id: str) -> Dict[str, Any]:
    sb = _require_supabase()
    try:
        res = sb.table("saved_deals").select("*").eq("id", deal_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Saved deal not found")
        return {"data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.delete("/saved-deals/{deal_id}")
async def delete_saved_deal(deal_id: str) -> Dict[str, Any]:
    """Delete one saved deal by id."""
    sb = _require_supabase()
    try:
        res = sb.table("saved_deals").delete().eq("id", deal_id).execute()
        # Supabase returns count only if enabled on table; still treat as success if no error.
        return {"deleted": True, "result": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e
