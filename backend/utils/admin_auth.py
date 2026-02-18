from __future__ import annotations

import os

from fastapi import HTTPException, Request


def get_expected_admin_token() -> str | None:
    return (os.getenv("IMPORT_ADMIN_TOKEN") or os.getenv("ADMIN_TOKEN") or "").strip() or None


def extract_bearer(authorization: str | None) -> str | None:
    v = (authorization or "").strip()
    if not v:
        return None
    parts = v.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1].strip()
        return token or None
    return None


def require_admin(request: Request) -> None:
    """Require a valid admin token.

    Accepts either:
      - Authorization: Bearer <token>
      - X-Admin-Token: <token>

    Token is compared to IMPORT_ADMIN_TOKEN (preferred) or ADMIN_TOKEN.
    """

    expected = get_expected_admin_token()
    if not expected:
        raise HTTPException(status_code=401, detail="Admin token required")

    auth_header = request.headers.get("authorization")
    x_admin = request.headers.get("x-admin-token")

    provided = extract_bearer(auth_header) or ((x_admin or "").strip() or None)
    if not provided or provided != expected:
        raise HTTPException(status_code=401, detail="Admin token required")
