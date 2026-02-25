from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from backend.services.providers import get_comps_from_provider

router = APIRouter(prefix="/comps", tags=["comps"])


@router.get("/{postcode}")
def get_comps(postcode: str, request: Request) -> Dict[str, Any]:
    pc = (postcode or "").strip().upper()
    if not pc:
        raise HTTPException(status_code=400, detail="postcode required")

    try:
        data = get_comps_from_provider(pc)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"provider error: {e}")

    # Keep backward-compatible shape for callers.
    if isinstance(data, dict):
        return {"source": "provider", **data}
    return {"source": "provider", "postcode": pc, "sales": [], "rents": []}
