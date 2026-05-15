from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv

from backend.utils.supabase_client import get_supabase
from backend.utils.top_deal_ranker import TOP_DEAL_VERSION

load_dotenv()
load_dotenv("backend/.env", override=False)


FULL_POSTCODE_RE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.I)


def _rows(sb: Any, table: str, cols: str, *, limit: int = 10000) -> list[dict[str, Any]]:
    try:
        res = sb.table(table).select(cols).limit(limit).execute()
        return [row for row in (getattr(res, "data", None) or []) if isinstance(row, dict)]
    except Exception:
        return []


def _parse_dt(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _has_image(row: dict[str, Any]) -> bool:
    return bool(row.get("imageurl")) or bool(row.get("image_urls"))


def _postcode_quality(row: dict[str, Any]) -> str:
    value = str(row.get("postcode") or "").strip()
    if FULL_POSTCODE_RE.search(value):
        return "full"
    return "outward" if value else "missing"


def collect_launch_health(sb: Any | None = None) -> dict[str, Any]:
    sb = sb or get_supabase(required=False)
    scraper_mode = (os.getenv("SCRAPER_MODE") or "direct").strip().lower()
    sources = [
        s.strip()
        for s in (os.getenv("INGEST_SOURCES") or "zoopla,onthemarket,spareroom").split(",")
        if s.strip()
    ]

    report: dict[str, Any] = {
        "operational": {
            "backend_health": "ok",
            "supabase_configured": bool(sb),
            "top_deal_version": TOP_DEAL_VERSION,
            "scraperapi_mode": "enabled" if scraper_mode == "scraperapi" else "disabled",
            "scraper_mode": scraper_mode,
            "direct_mode_sources": sources,
        },
        "data": {},
        "security": {"broad_public_policy_check": "not_checked"},
    }
    if not sb:
        report["data"] = {"error": "Supabase is not configured"}
        return report

    props = _rows(
        sb,
        "properties",
        "id,source,source_url,url,imageurl,image_urls,postcode,top_deal_score,top_deal_tier,"
        "price_change_count,created_at,score_updated_at,last_seen_at",
    )
    tiers = Counter(str(row.get("top_deal_tier") or "standard").lower() for row in props)
    source_counts = Counter(str(row.get("source") or "unknown").lower() for row in props)
    postcode_counts = Counter(_postcode_quality(row) for row in props)
    report["data"] = {
        "total_properties": len(props),
        "scored_properties": sum(1 for row in props if row.get("top_deal_score") is not None),
        "prime": tiers.get("prime", 0),
        "strong": tiers.get("strong", 0),
        "watchlist": tiers.get("watchlist", 0),
        "standard": tiers.get("standard", 0),
        "properties_with_source_url": sum(
            1 for row in props if row.get("source_url") or row.get("url")
        ),
        "properties_with_images": sum(1 for row in props if _has_image(row)),
        "properties_with_full_postcode": postcode_counts.get("full", 0),
        "properties_with_outward_only_postcode": postcode_counts.get("outward", 0),
        "properties_with_price_history_changes": sum(
            1 for row in props if int(row.get("price_change_count") or 0) > 0
        ),
        "source_distribution": dict(source_counts),
        "recent_created_at": [row.get("created_at") for row in props[:5]],
        "recent_updated_at": [
            row.get("last_seen_at") or row.get("score_updated_at") for row in props[:5]
        ],
    }

    runs = _rows(
        sb,
        "scrape_runs",
        "source,location,status,count_inserted,error,started_at,finished_at,created_at",
        limit=20,
    )
    report["operational"]["latest_scrape_runs"] = runs[:10]
    latest_run = runs[0] if runs else None
    latest_ts = _parse_dt(
        (latest_run or {}).get("finished_at") or (latest_run or {}).get("created_at")
    )
    stale_after = timedelta(seconds=max(1800, int(os.getenv("INGEST_STALE_SECONDS", "3600"))))
    ingestion_status = "unknown"
    if latest_run:
        run_status = str(latest_run.get("status") or "").lower()
        if run_status in {"error", "failed"}:
            ingestion_status = "degraded"
        elif latest_ts and datetime.now(timezone.utc) - latest_ts > stale_after:
            ingestion_status = "stale"
        else:
            ingestion_status = "healthy"
    report["operational"]["last_ingestion_run"] = latest_run
    report["operational"]["ingestion_status"] = ingestion_status
    return report


def print_human(report: dict[str, Any]) -> None:
    data = report.get("data", {})
    ops = report.get("operational", {})
    print("Launch health")
    print(f"Supabase configured: {ops.get('supabase_configured')}")
    print(f"Scraper mode: {ops.get('scraper_mode')} ({ops.get('scraperapi_mode')})")
    print(f"Direct sources: {', '.join(ops.get('direct_mode_sources') or [])}")
    for key in (
        "total_properties",
        "scored_properties",
        "prime",
        "strong",
        "watchlist",
        "standard",
        "properties_with_source_url",
        "properties_with_images",
        "properties_with_full_postcode",
        "properties_with_outward_only_postcode",
        "properties_with_price_history_changes",
    ):
        print(f"{key}: {data.get(key, 0)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Print launch readiness data from Supabase.")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    report = collect_launch_health()
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_human(report)


if __name__ == "__main__":
    main()
