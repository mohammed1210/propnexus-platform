from __future__ import annotations

from typing import Any, Dict, Set


def sanitize_property_payload(payload: Dict[str, Any], allowed_fields: Set[str]) -> Dict[str, Any]:
    """Filter a property payload down to known DB fields.

    This is a safety net for Supabase/PostgREST schema-cache mismatches (e.g.
    sending `raw_property_type` when the column doesn't exist).
    """

    if not isinstance(payload, dict) or not allowed_fields:
        return {}
    return {k: v for k, v in payload.items() if k in allowed_fields}
