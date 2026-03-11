from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
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


def _insert_minimal(table: Any, row: dict[str, Any]) -> None:
    """Insert with minimal returning when supported by the client."""
    try:
        table.insert(row, returning="minimal").execute()
    except TypeError:
        table.insert(row).execute()


def _postgres_url() -> str:
    return str(
        os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRESQL_URL") or ""
    ).strip()


def _insert_search_click_via_postgres(row: dict[str, Any], legacy_row: dict[str, Any]) -> None:
    pg_url = _postgres_url()
    if not pg_url:
        raise RuntimeError("DATABASE_URL/POSTGRES_URL not configured")

    from sqlalchemy import create_engine, text

    engine = create_engine(pg_url, future=True, pool_pre_ping=True)
    with engine.begin() as conn:
        cols = conn.execute(
            text(
                """
                select column_name
                from information_schema.columns
                where table_schema = 'analytics'
                  and table_name = 'search_clicks'
                """
            )
        ).scalars()
        allowed = set(cols)
        if not allowed:
            raise RuntimeError("analytics.search_clicks not found")

        payload = {k: v for k, v in row.items() if k in allowed}
        if "query_id" not in payload or "listing_id" not in payload:
            payload = {k: v for k, v in legacy_row.items() if k in allowed}

        if "filters_json" in payload and payload["filters_json"] is not None:
            payload["filters_json"] = json.dumps(payload["filters_json"])

        if not payload:
            raise RuntimeError("No compatible columns found for analytics.search_clicks")

        col_list = ", ".join(payload.keys())
        val_list = ", ".join(f":{k}" for k in payload.keys())
        conn.execute(
            text(f"insert into analytics.search_clicks ({col_list}) values ({val_list})"),
            payload,
        )


class SearchClickEvent(BaseModel):
    query: str = ""
    property_id: UUID | None = None
    position: int | None = Field(default=None, ge=1)
    filters_json: dict[str, Any] | None = None
    session_id: str | None = None
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

    property_id = payload.property_id or payload.listing_id
    position = payload.position if payload.position is not None else payload.rank
    query_text = str(payload.query or "").strip()
    session_id = str(payload.session_id or "").strip()

    if session_id and query_text and property_id:
        dedupe_from = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
        try:
            existing = (
                sb.schema("analytics")
                .table("search_clicks")
                .select("id")
                .eq("session_id", session_id)
                .eq("query", query_text)
                .eq("property_id", str(property_id))
                .gte("created_at", dedupe_from)
                .limit(1)
                .execute()
            )
            if existing.data:
                return {"ok": True, "deduped": True}
        except Exception:
            pass

    row = {
        "query": query_text,
        "property_id": str(property_id),
        "position": position,
        "filters_json": payload.filters_json or {},
        "session_id": session_id,
        "query_id": str(payload.query_id),
        "listing_id": str(payload.listing_id),
        "rank": payload.rank,
        "user_id": str(payload.user_id) if payload.user_id else None,
    }

    legacy_row = {
        "query_id": str(payload.query_id),
        "listing_id": str(payload.listing_id),
        "rank": payload.rank,
        "user_id": str(payload.user_id) if payload.user_id else None,
    }

    try:
        # Preferred: explicit analytics schema.
        _insert_minimal(sb.schema("analytics").table("search_clicks"), row)
    except Exception:
        try:
            # Handle partially-migrated table shapes where newer columns are not present.
            _insert_minimal(sb.schema("analytics").table("search_clicks"), legacy_row)
        except Exception:
            try:
                # Fallback for clients/environments without schema() support.
                _insert_minimal(sb.table("search_clicks"), row)
            except Exception:
                try:
                    # Final fallback for legacy public-schema table shape.
                    _insert_minimal(sb.table("search_clicks"), legacy_row)
                except HTTPException:
                    raise
                except Exception as exc:
                    try:
                        # Last-resort write path that bypasses PostgREST response generation.
                        _insert_search_click_via_postgres(row, legacy_row)
                    except Exception as pg_exc:
                        raise HTTPException(
                            status_code=500,
                            detail=(
                                "Failed to write search click: "
                                f"supabase_error={exc}; postgres_fallback_error={pg_exc}"
                            ),
                        )

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
