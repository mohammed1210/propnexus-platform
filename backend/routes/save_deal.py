"""API routes for saving and managing investment deals."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Header, Request, status
from jose import jwt, JWTError

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


def _extract_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """
    Extract user_id from JWT token in Authorization header.
    Expected format: "Bearer <token>"
    Returns None if token is invalid or missing.
    """
    if not authorization:
        return None
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    token = parts[1]
    
    try:
        # Decode JWT without verification to extract claims
        # Supabase tokens have user_id in the 'sub' field
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
            algorithms=["HS256"]
        )
        
        # Extract user_id from 'sub' field (Supabase standard)
        return payload.get("sub")
    except JWTError:
        # JWT decode failed - invalid token format
        return None
    except Exception:
        # Unexpected error during token processing
        return None


@router.post("/save-deal")
async def save_deal(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Insert one saved deal.
    Frontend can post minimal payload like {"property_id": "..."} or a richer record.
    Attaches user_id from Authorization: Bearer JWT (sub claim) on insert.
    """
    sb = _require_supabase()
    
    # Extract user_id from JWT token
    user_id = _extract_user_id_from_token(authorization)
    
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Body must be a JSON object")

        # Ensure a timestamp
        payload.setdefault("saved_at", _now_iso())
        
        # Attach user_id if we have one from the token
        if user_id:
            payload["user_id"] = user_id

        res = sb.table("saved_deals").insert(payload).select("*").execute()
        return {"message": "Deal saved", "data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals")
async def list_saved_deals(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Return saved deals for the current user (newest first).
    Filters by user_id from Authorization token if provided.
    RLS policies enforce per-user access.
    """
    sb = _require_supabase()
    
    # Extract user_id from JWT token
    user_id = _extract_user_id_from_token(authorization)
    
    try:
        query = sb.table("saved_deals").select("*").order("saved_at", desc=True)
        
        # Filter by user_id if we have one (RLS will also enforce this)
        if user_id:
            query = query.eq("user_id", user_id)
        
        res = query.execute()
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
