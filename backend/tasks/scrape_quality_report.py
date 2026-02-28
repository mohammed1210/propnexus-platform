"""Quick CLI to inspect scrape data quality in Supabase.

Run inside the backend venv:

    python -m tasks.scrape_quality_report

It prints, per source, how many recent rows are missing
bedrooms, bathrooms, description, or imageurl.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List

from db import require_sb


def fetch_recent_properties(limit: int = 500) -> List[Dict[str, Any]]:
    sb = require_sb()

    resp = (
        sb.table("properties")  # type: ignore[union-attr]
        .select(
            "id,source,external_id,title,price,bedrooms,bathrooms,description,imageurl,created_at",
        )
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    data = getattr(resp, "data", None) or []
    return data


def analyse(rows: List[Dict[str, Any]]) -> None:
    by_source: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        src = (r.get("source") or "unknown").lower()
        by_source[src].append(r)

    print("\nScrape quality report (last {} rows):".format(len(rows)))
    for src, items in sorted(by_source.items(), key=lambda kv: kv[0]):
        total = len(items)
        if total == 0:
            continue

        missing = Counter()
        for r in items:
            if not r.get("bedrooms"):
                missing["bedrooms"] += 1
            if not r.get("bathrooms"):
                missing["bathrooms"] += 1
            desc = r.get("description")
            if not desc or not str(desc).strip():
                missing["description"] += 1
            if not r.get("imageurl"):
                missing["imageurl"] += 1

        print(f"\nSource: {src} (n={total})")
        for field in ("bedrooms", "bathrooms", "description", "imageurl"):
            count = missing.get(field, 0)
            pct = (count / total) * 100 if total else 0.0
            print(f"  {field:11}: {count:4d} missing ({pct:5.1f}%)")


def main() -> None:
    rows = fetch_recent_properties(limit=500)
    analyse(rows)


if __name__ == "__main__":  # pragma: no cover
    main()
