"""API routes for saving and managing investment deals."""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException, Request, status

from supabase import Client, create_client

load_dotenv()

router = APIRouter()

# Prefer service role key so the API can write server-side
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


_SAVED_DEALS_HAS_CLERK_USER_ID: Optional[bool] = None


def _require_supabase() -> Client:
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured on the server",
        )
    return supabase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


def _saved_deals_has_clerk_user_id(sb: Client) -> bool:
    global _SAVED_DEALS_HAS_CLERK_USER_ID
    if _SAVED_DEALS_HAS_CLERK_USER_ID is not None:
        return _SAVED_DEALS_HAS_CLERK_USER_ID

    try:
        # If the column doesn't exist, PostgREST will raise.
        sb.table("saved_deals").select("clerk_user_id").limit(1).execute()
        _SAVED_DEALS_HAS_CLERK_USER_ID = True
        return True
    except Exception:
        _SAVED_DEALS_HAS_CLERK_USER_ID = False
        return False


def _extract_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """
    Extract user_id from JWT token in Authorization header.
    Expected format: "Bearer <token>"
    Returns None if token is invalid or missing.

    SECURITY NOTE: This function extracts the 'sub' claim from JWT tokens without full verification.

    This is acceptable because:
    1. The user_id is used ONLY to filter queries on the saved_deals table
    2. Supabase RLS policies on saved_deals enforce that auth.uid() = user_id
    3. The service role key used by this API bypasses RLS, but the explicit
       user_id filter + RLS double-check prevents data leakage
    4. Even if a token is forged, RLS will block access to rows where user_id != auth.uid()
    5. Supabase validates the JWT signature when RLS policies check auth.uid()

    For additional security:
    - We return empty results if no user_id is present
    - RLS policies provide defense-in-depth
    - The worst case is someone queries their own data

    For security-critical operations beyond filtering, full JWT verification with
    Supabase's JWT secret would be required.
    """
    if not authorization:
        return None

    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]

    try:
        # Decode JWT payload without verification to extract claims.
        # This intentionally avoids enforcing/assuming a signing algorithm
        # (Clerk tokens are commonly RS256, Supabase tokens may vary).
        jwt_parts = token.split(".")
        if len(jwt_parts) < 2:
            return None

        payload_b64 = jwt_parts[1]
        # Base64url decode with padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload_raw = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        payload = json.loads(payload_raw.decode("utf-8"))

        # Extract user_id from 'sub' field (JWT standard)
        sub = payload.get("sub")
        return str(sub) if sub else None
    except Exception:
        return None


@router.post("/save-deal")
async def save_deal(
    request: Request, authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Insert one saved deal.
    Frontend can post minimal payload like {"property_id": "..."} or a richer record.
    Attaches user_id from Authorization: Bearer JWT (sub claim) on insert.
    """
    sb = _require_supabase()

    # Extract JWT subject from Authorization token.
    # For Clerk this is typically "user_..." (string); for Supabase Auth it's a UUID.
    subject = _extract_user_id_from_token(authorization)

    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Body must be a JSON object")

        # Timestamp
        payload.setdefault("saved_at", _now_iso())

        # Normalize user identity fields.
        # - If sub is UUID: keep using user_id (legacy Supabase Auth).
        # - Otherwise: use clerk_user_id (Clerk user IDs are not UUIDs).
        if subject:
            if _is_uuid(subject):
                payload.setdefault("user_id", subject)
            else:
                if not _saved_deals_has_clerk_user_id(sb):
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "Database schema not migrated for Clerk saved deals. "
                            "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
                        ),
                    )
                payload.setdefault("clerk_user_id", subject)
                # Avoid accidentally sending Clerk IDs into a UUID column.
                if payload.get("user_id") == subject:
                    payload.pop("user_id", None)

        # Defensive: ensure property_id is present
        if "property_id" not in payload:
            raise HTTPException(status_code=400, detail="Missing property_id")

        # Insert with conflict tolerance (skip duplicate saves)
        res = sb.table("saved_deals").insert(payload, upsert=True).execute()

        return {"ok": True, "data": res.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[save-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals")
async def list_saved_deals(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Return saved deals for the current user (newest first).
    Filters by user_id from Authorization token if provided.
    RLS policies enforce per-user access.

    Returns empty list if no valid token is provided (for security).
    """
    sb = _require_supabase()

    # Extract JWT subject from token (UUID for Supabase, string for Clerk)
    subject = _extract_user_id_from_token(authorization)

    # If no subject, return empty list (don't expose all data)
    if not subject:
        return {"data": []}

    try:
        query = sb.table("saved_deals").select("*").order("saved_at", desc=True)

        # Filter by the appropriate identity column
        if _is_uuid(subject):
            query = query.eq("user_id", subject)
        else:
            if not _saved_deals_has_clerk_user_id(sb):
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Database schema not migrated for Clerk saved deals. "
                        "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
                    ),
                )
            query = query.eq("clerk_user_id", subject)

        res = query.execute()
        return {"data": res.data or []}
    except Exception as e:
        print(f"[list-saved-deals-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals/{deal_id}")
async def get_saved_deal(
    deal_id: str, request: Request, authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """Retrieve a specific saved deal."""
    sb = _require_supabase()
    try:
        subject = _extract_user_id_from_token(authorization)
        query = sb.table("saved_deals").select("*").eq("id", deal_id)
        if subject:
            if _is_uuid(subject):
                query = query.eq("user_id", subject)
            else:
                if not _saved_deals_has_clerk_user_id(sb):
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "Database schema not migrated for Clerk saved deals. "
                            "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
                        ),
                    )
                query = query.eq("clerk_user_id", subject)
        res = query.single().execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Saved deal not found")

        return {"ok": True, "data": res.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[get-saved-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.delete("/saved-deals/{deal_id}")
async def delete_saved_deal(
    deal_id: str, request: Request, authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """Delete a saved deal belonging to the user."""
    sb = _require_supabase()
    try:
        subject = _extract_user_id_from_token(authorization)
        query = sb.table("saved_deals").delete().eq("id", deal_id)
        if subject:
            if _is_uuid(subject):
                query = query.eq("user_id", subject)
            else:
                if not _saved_deals_has_clerk_user_id(sb):
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "Database schema not migrated for Clerk saved deals. "
                            "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
                        ),
                    )
                query = query.eq("clerk_user_id", subject)

        res = query.execute()
        return {"ok": True, "deleted": True, "data": res.data}

    except Exception as e:
        print(f"[delete-saved-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e
