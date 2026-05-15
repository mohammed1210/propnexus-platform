from __future__ import annotations

import argparse
from typing import Any

from dotenv import load_dotenv

from backend.utils.property_quality import build_quality_patch
from backend.utils.supabase_client import get_supabase

load_dotenv()
load_dotenv("backend/.env", override=False)


SELECT_COLUMNS = (
    "id,title,description,location,address,postcode,source,url,source_url,original_listing_url,"
    "listing_url,property_url,external_url,imageurl,image_urls,data"
)


def _fetch_batch(sb: Any, *, offset: int, batch_size: int) -> list[dict[str, Any]]:
    res = (
        sb.table("properties")
        .select(SELECT_COLUMNS)
        .range(offset, offset + batch_size - 1)
        .execute()
    )
    return [row for row in (getattr(res, "data", None) or []) if isinstance(row, dict)]


def backfill_property_quality(
    sb: Any,
    *,
    limit: int | None = None,
    batch_size: int = 100,
    dry_run: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    summary = {"total_scanned": 0, "updated": 0, "skipped": 0, "errors": 0, "dry_run": dry_run}
    offset = 0
    scanned = 0
    while True:
        if limit is not None and scanned >= limit:
            break
        current_batch_size = min(batch_size, limit - scanned) if limit is not None else batch_size
        rows = _fetch_batch(sb, offset=offset, batch_size=current_batch_size)
        if not rows:
            break

        updates: list[dict[str, Any]] = []
        for row in rows:
            scanned += 1
            summary["total_scanned"] += 1
            try:
                patch = build_quality_patch(row, force=force)
                if not patch:
                    summary["skipped"] += 1
                    continue
                patch["id"] = row["id"]
                updates.append(patch)
            except Exception:
                summary["errors"] += 1

        if updates:
            summary["updated"] += len(updates)
            if not dry_run:
                for i in range(0, len(updates), batch_size):
                    sb.table("properties").upsert(
                        updates[i : i + batch_size], on_conflict="id"
                    ).execute()

        offset += len(rows)
        if len(rows) < current_batch_size:
            break
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill launch-safe property quality fields.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    sb = get_supabase(required=True)
    summary = backfill_property_quality(
        sb,
        limit=args.limit if args.limit and args.limit > 0 else None,
        batch_size=max(1, args.batch_size),
        dry_run=args.dry_run,
        force=args.force,
    )
    for key in ("total_scanned", "updated", "skipped", "errors"):
        print(f"{key}: {summary.get(key, 0)}")


if __name__ == "__main__":
    main()
