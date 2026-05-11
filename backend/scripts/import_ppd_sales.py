from __future__ import annotations

import argparse
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List

from backend.utils.supabase_client import get_supabase

PPD_COLUMNS = [
    "transaction_id",
    "price",
    "date_of_transfer",
    "postcode",
    "property_type",
    "new_build",
    "tenure",
    "paon",
    "saon",
    "street",
    "locality",
    "town_city",
    "district",
    "county",
    "ppd_category_type",
    "record_status",
]


def _bool(value: str | None) -> bool | None:
    if value is None:
        return None
    v = value.strip().upper()
    if v in {"Y", "YES", "TRUE", "1"}:
        return True
    if v in {"N", "NO", "FALSE", "0"}:
        return False
    return None


def _int(value: str | None) -> int | None:
    try:
        return int(str(value or "").strip())
    except Exception:
        return None


def _date(value: str | None) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    # Official HM Land Registry PPD exports use values like
    # `2024-01-31 00:00`; Supabase `date` columns should receive YYYY-MM-DD.
    candidate = raw[:10]
    try:
        datetime.strptime(candidate, "%Y-%m-%d")
        return candidate
    except Exception:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except Exception:
            continue
    return None


def _normalise_prefixes(values: Iterable[str | None]) -> tuple[str, ...]:
    prefixes: list[str] = []
    seen: set[str] = set()
    for value in values:
        for part in str(value or "").replace(";", ",").split(","):
            prefix = part.strip().upper().replace(" ", "")
            if prefix and prefix not in seen:
                prefixes.append(prefix)
                seen.add(prefix)
    return tuple(prefixes)


def _normalise_row(row: Dict[str, Any]) -> Dict[str, Any] | None:
    postcode = " ".join(str(row.get("postcode") or "").strip().upper().split())
    transaction_id = str(row.get("transaction_id") or "").strip().strip("{}")
    price = _int(row.get("price"))
    date_of_transfer = _date(row.get("date_of_transfer"))
    if not postcode or not transaction_id or not price or not date_of_transfer:
        return None
    return {
        "transaction_id": transaction_id,
        "price": price,
        "date_of_transfer": date_of_transfer,
        "postcode": postcode,
        "property_type": str(row.get("property_type") or "").strip() or None,
        "new_build": _bool(row.get("new_build")),
        "tenure": str(row.get("tenure") or "").strip() or None,
        "paon": str(row.get("paon") or "").strip() or None,
        "saon": str(row.get("saon") or "").strip() or None,
        "street": str(row.get("street") or "").strip() or None,
        "locality": str(row.get("locality") or "").strip() or None,
        "town_city": str(row.get("town_city") or "").strip() or None,
        "district": str(row.get("district") or "").strip() or None,
        "county": str(row.get("county") or "").strip() or None,
    }


def _iter_rows(path: Path, postcode_prefixes: Iterable[str | None]) -> Iterable[Dict[str, Any]]:
    prefixes = _normalise_prefixes(postcode_prefixes)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        first_line = handle.readline()
        handle.seek(0)
        first_line_lower = first_line.lower()
        has_header = "transaction" in first_line_lower or "postcode" in first_line_lower
        if has_header:
            reader = csv.DictReader(handle)
        else:
            reader = csv.DictReader(handle, fieldnames=PPD_COLUMNS)
        for row in reader:
            normalised = _normalise_row(row)
            if not normalised:
                continue
            postcode = str(normalised["postcode"]).replace(" ", "")
            if prefixes and not any(postcode.startswith(prefix) for prefix in prefixes):
                continue
            yield normalised


def _chunks(rows: Iterable[Dict[str, Any]], size: int) -> Iterable[List[Dict[str, Any]]]:
    batch: List[Dict[str, Any]] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import Land Registry PPD CSV rows into Supabase ppd_sales."
    )
    parser.add_argument("csv_path", nargs="?", help="Path to PPD CSV file")
    parser.add_argument(
        "--csv",
        dest="csv_path_option",
        default=None,
        help="Path to PPD CSV file (alternative to positional csv_path)",
    )
    parser.add_argument(
        "--prefix",
        "--postcode-prefix",
        dest="postcode_prefixes",
        action="append",
        default=None,
        help="Optional postcode prefix filter; repeat for launch areas, e.g. --prefix IG --prefix RM",
    )
    parser.add_argument(
        "--batch-size", type=int, default=int(os.getenv("PPD_IMPORT_BATCH_SIZE", "500"))
    )
    args = parser.parse_args()

    csv_path = args.csv_path_option or args.csv_path or os.getenv("PPD_CSV_PATH")
    if not csv_path:
        raise SystemExit("csv_path or PPD_CSV_PATH is required")
    path = Path(csv_path)
    if not path.exists():
        raise SystemExit(f"CSV not found: {path}")

    prefixes = _normalise_prefixes(
        [*(args.postcode_prefixes or []), os.getenv("PPD_POSTCODE_PREFIX")]
    )
    if prefixes:
        print(f"Filtering PPD import to postcode prefixes: {', '.join(prefixes)}")

    sb = get_supabase(required=True)
    total = 0
    for batch in _chunks(_iter_rows(path, prefixes), max(1, args.batch_size)):
        sb.table("ppd_sales").upsert(batch, on_conflict="transaction_id").execute()
        total += len(batch)
        print(f"Imported {total} rows...", flush=True)
    print(f"Done. Imported/upserted {total} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
