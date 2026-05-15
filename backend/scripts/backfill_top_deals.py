from __future__ import annotations

import argparse
from typing import Any

from dotenv import load_dotenv

from backend.utils.ppd_comps import get_sold_comps_summary
from backend.utils.supabase_client import get_supabase
from backend.utils.top_deal_ranker import TOP_DEAL_VERSION, apply_top_deal_ranking

load_dotenv()
load_dotenv("backend/.env", override=False)


SELECT_COLUMNS = (
    "id,title,description,price,bedrooms,bathrooms,property_type,address,location,postcode,"
    "source,url,source_url,original_listing_url,listing_url,property_url,external_url,original_url,"
    "rightmove_url,zoopla_url,onthemarket_url,imageurl,image_urls,yield_percent,roi_percent,"
    "score_breakdown,search_metadata,first_seen_at,last_seen_at,"
    "initial_price,previous_price,last_price_change_at,price_change_count,price_history,"
    "top_deal_score,top_deal_tier,top_deal_reasons,data"
)


def _current_version(row: dict[str, Any]) -> bool:
    data = row.get("data") if isinstance(row.get("data"), dict) else {}
    top_deal = data.get("top_deal") if isinstance(data.get("top_deal"), dict) else {}
    evidence = top_deal.get("evidence") if isinstance(top_deal.get("evidence"), dict) else {}
    return evidence.get("version") == TOP_DEAL_VERSION and row.get("top_deal_score") is not None


def _required_fields_missing(row: dict[str, Any]) -> bool:
    return (
        not row.get("id")
        or not row.get("price")
        or not (row.get("title") or row.get("description"))
    )


def _fetch_batch(
    sb: Any, *, offset: int, batch_size: int, source: str | None
) -> list[dict[str, Any]]:
    query = sb.table("properties").select(SELECT_COLUMNS).range(offset, offset + batch_size - 1)
    if source:
        query = query.eq("source", source.strip().lower())
    res = query.execute()
    return [row for row in (getattr(res, "data", None) or []) if isinstance(row, dict)]


def backfill_top_deals(
    sb: Any,
    *,
    limit: int | None = None,
    batch_size: int = 100,
    dry_run: bool = False,
    force: bool = False,
    source: str | None = None,
) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "total_scanned": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "prime": 0,
        "strong": 0,
        "watchlist": 0,
        "standard": 0,
        "dry_run": dry_run,
        "force": force,
    }
    offset = 0
    scanned = 0

    while True:
        if limit is not None and scanned >= limit:
            break
        current_batch_size = min(batch_size, limit - scanned) if limit is not None else batch_size
        rows = _fetch_batch(sb, offset=offset, batch_size=current_batch_size, source=source)
        if not rows:
            break
        updates: list[dict[str, Any]] = []
        for row in rows:
            scanned += 1
            summary["total_scanned"] += 1
            try:
                if _required_fields_missing(row):
                    summary["skipped"] += 1
                    continue
                if not force and _current_version(row):
                    summary["skipped"] += 1
                    continue

                sold_comps = None
                postcode = row.get("postcode")
                if isinstance(postcode, str) and postcode.strip():
                    try:
                        sold_comps = get_sold_comps_summary(sb, postcode=postcode, limit=20)
                    except Exception:
                        sold_comps = None

                ranked = apply_top_deal_ranking(row, sold_comps=sold_comps)
                tier = str(ranked.get("top_deal_tier") or "standard")
                if tier not in {"prime", "strong", "watchlist", "standard"}:
                    tier = "standard"
                summary[tier] += 1
                patch = {
                    "id": row["id"],
                    "top_deal_score": ranked.get("top_deal_score"),
                    "top_deal_tier": ranked.get("top_deal_tier"),
                    "top_deal_reasons": ranked.get("top_deal_reasons"),
                    "data": ranked.get("data"),
                }
                updates.append(patch)
            except Exception:
                summary["errors"] += 1

        if updates:
            summary["updated"] += len(updates)
            if not dry_run:
                for i in range(0, len(updates), batch_size):
                    chunk = updates[i : i + batch_size]
                    sb.table("properties").upsert(chunk, on_conflict="id").execute()

        offset += len(rows)
        if len(rows) < current_batch_size:
            break

    return summary


def print_summary(summary: dict[str, Any]) -> None:
    for key in (
        "total_scanned",
        "updated",
        "skipped",
        "prime",
        "strong",
        "watchlist",
        "standard",
        "errors",
    ):
        print(f"{key}: {summary.get(key, 0)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill evidence-backed Top Deal scoring.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--source", default=None)
    args = parser.parse_args()

    sb = get_supabase(required=True)
    summary = backfill_top_deals(
        sb,
        limit=args.limit if args.limit and args.limit > 0 else None,
        batch_size=max(1, args.batch_size),
        dry_run=args.dry_run,
        force=args.force,
        source=args.source,
    )
    print_summary(summary)


if __name__ == "__main__":
    main()
