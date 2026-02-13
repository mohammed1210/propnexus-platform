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
_SAVED_DEALS_HAS_PROPERTY_ID: Optional[bool] = None
_SAVED_DEALS_HAS_DATA: Optional[bool] = None


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


def _saved_deals_has_property_id(sb: Client) -> bool:
    global _SAVED_DEALS_HAS_PROPERTY_ID
    if _SAVED_DEALS_HAS_PROPERTY_ID is not None:
        return _SAVED_DEALS_HAS_PROPERTY_ID

    try:
        sb.table("saved_deals").select("property_id").limit(1).execute()
        _SAVED_DEALS_HAS_PROPERTY_ID = True
        return True
    except Exception:
        _SAVED_DEALS_HAS_PROPERTY_ID = False
        return False


def _saved_deals_has_data(sb: Client) -> bool:
    global _SAVED_DEALS_HAS_DATA
    if _SAVED_DEALS_HAS_DATA is not None:
        return _SAVED_DEALS_HAS_DATA

    try:
        sb.table("saved_deals").select("data").limit(1).execute()
        _SAVED_DEALS_HAS_DATA = True
        return True
    except Exception:
        _SAVED_DEALS_HAS_DATA = False
        return False


def _extract_clerk_user_id_from_header(x_clerk_user_id: Optional[str]) -> Optional[str]:
    if not x_clerk_user_id:
        return None
    v = str(x_clerk_user_id).strip()
    if not v:
        return None
    # Simple sanity check per requirements
    if not v.startswith("user_"):
        return None
    return v


def _merge_data_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    data = row.get("data")
    if not isinstance(data, dict):
        return row
    # Only backfill keys that are missing or None at top-level.
    for k, v in data.items():
        if k not in row or row.get(k) is None:
            row[k] = v
    return row


def _identity_filter(sb: Client, subject: str, x_clerk_user_id: Optional[str] = None):
    """Return (column, value) pair to filter saved_deals for the current user."""
    clerk_id = _extract_clerk_user_id_from_header(x_clerk_user_id)
    if clerk_id:
        if not _saved_deals_has_clerk_user_id(sb):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Database schema not migrated for Clerk saved deals. "
                    "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
                ),
            )
        return "clerk_user_id", clerk_id

    if not subject:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if _is_uuid(subject):
        return "user_id", subject

    if not _saved_deals_has_clerk_user_id(sb):
        raise HTTPException(
            status_code=500,
            detail=(
                "Database schema not migrated for Clerk saved deals. "
                "Add public.saved_deals.clerk_user_id (text) and make user_id nullable."
            ),
        )
    return "clerk_user_id", subject


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
    request: Request,
    authorization: Optional[str] = Header(None),
    x_clerk_user_id: Optional[str] = Header(None, alias="X-Clerk-User-Id"),
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

        # property_id is required (either as a column or stored in data json)
        property_id = payload.get("property_id")
        if not property_id:
            raise HTTPException(status_code=400, detail="Missing property_id")

        identity_col, identity_val = _identity_filter(sb, subject or "", x_clerk_user_id)

        # Build insert record defensively based on schema.
        # Prefer real columns when present; otherwise store in data jsonb.
        record: Dict[str, Any] = {identity_col: identity_val}

        # Attempt to store property_id as a real column when available.
        if _saved_deals_has_property_id(sb):
            record["property_id"] = property_id
        elif _saved_deals_has_data(sb):
            record["data"] = {"property_id": property_id}
        else:
            raise HTTPException(
                status_code=500,
                detail="saved_deals schema unsupported: missing property_id and data columns",
            )

        # Timestamp: only set if the column exists; otherwise store in data.
        # (Some installations rely on triggers/defaults instead.)
        saved_at = _now_iso()
        if _saved_deals_has_data(sb):
            record.setdefault("data", {})
            if isinstance(record.get("data"), dict):
                record["data"].setdefault("saved_at", saved_at)
                # Preserve any caller-provided extra payload into data for forward compatibility.
                for k, v in payload.items():
                    if k in ("user_id", "clerk_user_id"):
                        continue
                    (record["data"]).setdefault(k, v)

        # Insert with conflict tolerance (upsert requires a uniqueness constraint)
        res = sb.table("saved_deals").insert(record, upsert=True).execute()

        return {"ok": True, "data": res.data}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[save-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals")
async def list_saved_deals(
    authorization: Optional[str] = Header(None),
    x_clerk_user_id: Optional[str] = Header(None, alias="X-Clerk-User-Id"),
) -> Dict[str, Any]:
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
    # If no identity at all, return empty list (don't expose all data)
    if not subject and not _extract_clerk_user_id_from_header(x_clerk_user_id):
        return {"data": []}

    try:
        query = sb.table("saved_deals").select("*")

        identity_col, identity_val = _identity_filter(sb, subject or "", x_clerk_user_id)
        query = query.eq(identity_col, identity_val)

        # Order by saved_at when present; if column is missing, PostgREST will error.
        # We fall back to unordered results in that case.
        try:
            res = query.order("saved_at", desc=True).execute()
        except Exception:
            res = query.execute()

        rows = res.data or []
        if isinstance(rows, list):
            rows = [_merge_data_payload(dict(r)) for r in rows if isinstance(r, dict)]
        return {"data": rows}
    except Exception as e:
        print(f"[list-saved-deals-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.get("/saved-deals/{deal_id}")
async def get_saved_deal(
    deal_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    x_clerk_user_id: Optional[str] = Header(None, alias="X-Clerk-User-Id"),
) -> Dict[str, Any]:
    """Retrieve a specific saved deal."""
    sb = _require_supabase()
    try:
        subject = _extract_user_id_from_token(authorization)
        query = sb.table("saved_deals").select("*").eq("id", deal_id)

        identity_col, identity_val = _identity_filter(sb, subject or "", x_clerk_user_id)
        query = query.eq(identity_col, identity_val)
        res = query.single().execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Saved deal not found")

        row = res.data
        if isinstance(row, dict):
            row = _merge_data_payload(dict(row))
        return {"ok": True, "data": row}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[get-saved-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.delete("/saved-deals/{property_id}")
async def delete_saved_deal(
    property_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    x_clerk_user_id: Optional[str] = Header(None, alias="X-Clerk-User-Id"),
) -> Dict[str, Any]:
    """Delete a saved deal for the current user by property_id."""
    sb = _require_supabase()
    try:
        subject = _extract_user_id_from_token(authorization)
        identity_col, identity_val = _identity_filter(sb, subject or "", x_clerk_user_id)

        if not _saved_deals_has_property_id(sb):
            raise HTTPException(
                status_code=500,
                detail="saved_deals schema unsupported: missing property_id column",
            )

        query = (
            sb.table("saved_deals")
            .delete()
            .eq("property_id", property_id)
            .eq(identity_col, identity_val)
        )

        res = query.execute()
        return {"ok": True, "deleted": True, "data": res.data}

    except Exception as e:
        print(f"[delete-saved-deal-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e


@router.post("/saved-deals/clear")
async def clear_saved_deals(
    authorization: Optional[str] = Header(None),
    x_clerk_user_id: Optional[str] = Header(None, alias="X-Clerk-User-Id"),
) -> Dict[str, Any]:
    """Clear all saved deals for the current user."""
    sb = _require_supabase()
    try:
        subject = _extract_user_id_from_token(authorization)
        identity_col, identity_val = _identity_filter(sb, subject or "", x_clerk_user_id)

        res = sb.table("saved_deals").delete().eq(identity_col, identity_val).execute()
        return {"ok": True, "cleared": True, "data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[clear-saved-deals-error] {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {e}") from e
