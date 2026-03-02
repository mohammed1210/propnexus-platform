from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Request

from backend.db import require_sb
from backend.utils.admin_auth import require_admin

router = APIRouter(tags=["analytics"])


def _to_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except Exception:
        return default


def _fetch_rows_7d(sb: Any, table: str, cols: str) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        res = sb.schema("analytics").table(table).select(cols).gte("created_at", since).execute()
        return list(res.data or [])
    except Exception:
        try:
            res = sb.table(table).select(cols).gte("created_at", since).execute()
            return list(res.data or [])
        except Exception:
            return []


@router.get("/analytics/metrics")
def analytics_metrics(request: Request) -> dict[str, Any]:
    require_admin(request)
    sb = require_sb()

    query_rows = _fetch_rows_7d(sb, "search_queries", "query,results_count")
    click_rows = _fetch_rows_7d(sb, "search_clicks", "id")

    searches_total = len(query_rows)
    zero_rows = [r for r in query_rows if _to_int(r.get("results_count"), 0) <= 0]
    zero_results_rate = (len(zero_rows) / searches_total) if searches_total > 0 else 0.0
    ctr = (len(click_rows) / searches_total) if searches_total > 0 else 0.0

    top_zero_counter: Counter[str] = Counter(
        str(r.get("query") or "").strip().lower()
        for r in zero_rows
        if str(r.get("query") or "").strip()
    )
    top_zero_result_queries = [
        {"query": query, "count": count} for query, count in top_zero_counter.most_common(20)
    ]

    return {
        "searches_total": searches_total,
        "zero_results_rate": round(zero_results_rate, 4),
        "ctr": round(ctr, 4),
        "top_zero_result_queries": top_zero_result_queries,
    }
