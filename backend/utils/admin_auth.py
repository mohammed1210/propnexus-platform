from __future__ import annotations

import os

from fastapi import HTTPException, Request


def _extract_bearer(authorization: str | None) -> str | None:
    v = (authorization or "").strip()
    if not v:
        return None
    parts = v.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1].strip()
        return token or None
    return None


def get_admin_token_from_request(request: Request) -> str | None:
    """Extract an admin token from a request.

    Order matters (spec):
      1) Header: X-Admin-Token
      2) Header: Authorization: Bearer <token>
      3) Query param: ?admin_token=<token>
    """

    if not request:
        return None

    x_admin = (request.headers.get("x-admin-token") or "").strip()
    if x_admin:
        return x_admin

    bearer = _extract_bearer(request.headers.get("authorization"))
    if bearer:
        return bearer

    qp = request.query_params.get("admin_token") if hasattr(request, "query_params") else None
    qp_s = (qp or "").strip() if isinstance(qp, str) else ""
    return qp_s or None


def _get_expected_admin_token() -> str | None:
    # Spec: prefer ADMIN_TOKEN; fallback IMPORT_ADMIN_TOKEN.
    return (os.getenv("ADMIN_TOKEN") or os.getenv("IMPORT_ADMIN_TOKEN") or "").strip() or None


def require_admin(request: Request) -> None:
    expected = _get_expected_admin_token()
    provided = get_admin_token_from_request(request)

    if not expected or not provided or provided != expected:
        raise HTTPException(status_code=401, detail="Admin token required")
