from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from prometheus_client import Counter
from pydantic import BaseModel, Field

from backend.db import require_sb

router = APIRouter(prefix="/events", tags=["events"])

filter_click_total = Counter(
    "filter_click_total",
    "Total number of filter select events",
    ["facet"],
)


class SearchClickEvent(BaseModel):
    query_id: UUID
    listing_id: UUID
    rank: int | None = Field(default=None, ge=1)
    user_id: UUID | None = None


class FilterSelectEvent(BaseModel):
    facet: str
    value: str
    user_id: UUID | None = None


@router.post("/search_click")
def post_search_click(payload: SearchClickEvent) -> dict[str, Any]:
    sb = require_sb()

    row = {
        "query_id": str(payload.query_id),
        "listing_id": str(payload.listing_id),
        "rank": payload.rank,
        "user_id": str(payload.user_id) if payload.user_id else None,
    }

    try:
        # Preferred: explicit analytics schema.
        sb.schema("analytics").table("search_clicks").insert(row).execute()
    except Exception:
        try:
            # Fallback for clients/environments without schema() support.
            sb.table("search_clicks").insert(row).execute()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write search click: {exc}")

    return {"ok": True}


@router.post("/filter_select")
def post_filter_select(payload: FilterSelectEvent) -> dict[str, Any]:
    sb = require_sb()

    row = {
        "facet": str(payload.facet or "").strip(),
        "value": str(payload.value or "").strip(),
        "user_id": str(payload.user_id) if payload.user_id else None,
    }
    if not row["facet"] or not row["value"]:
        raise HTTPException(status_code=422, detail="facet and value are required")

    try:
        sb.schema("analytics").table("filter_clicks").insert(row).execute()
    except Exception:
        try:
            sb.table("filter_clicks").insert(row).execute()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write filter select: {exc}")

    filter_click_total.labels(facet=row["facet"]).inc()
    return {"ok": True}
