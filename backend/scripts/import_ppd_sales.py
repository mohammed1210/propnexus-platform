from __future__ import annotations

import argparse
import csv
import os
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


def _normalise_row(row: Dict[str, Any]) -> Dict[str, Any] | None:
    postcode = str(row.get("postcode") or "").strip().upper()
    transaction_id = str(row.get("transaction_id") or "").strip().strip("{}")
    price = _int(row.get("price"))
    if not postcode or not transaction_id or not price:
        return None
    return {
        "transaction_id": transaction_id,
        "price": price,
        "date_of_transfer": str(row.get("date_of_transfer") or "").strip() or None,
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


def _iter_rows(path: Path, postcode_prefix: str | None) -> Iterable[Dict[str, Any]]:
    prefix = (postcode_prefix or "").strip().upper()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(2048)
        handle.seek(0)
        has_header = "transaction" in sample.lower() or "postcode" in sample.lower()
        if has_header:
            reader = csv.DictReader(handle)
        else:
            reader = csv.DictReader(handle, fieldnames=PPD_COLUMNS)
        for row in reader:
            normalised = _normalise_row(row)
            if not normalised:
                continue
            if prefix and not str(normalised["postcode"]).startswith(prefix):
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
    parser.add_argument(
        "csv_path", nargs="?", default=os.getenv("PPD_CSV_PATH"), help="Path to PPD CSV file"
    )
    parser.add_argument(
        "--postcode-prefix",
        default=os.getenv("PPD_POSTCODE_PREFIX"),
        help="Optional outward postcode filter, e.g. IG3",
    )
    parser.add_argument(
        "--batch-size", type=int, default=int(os.getenv("PPD_IMPORT_BATCH_SIZE", "500"))
    )
    args = parser.parse_args()

    if not args.csv_path:
        raise SystemExit("csv_path or PPD_CSV_PATH is required")
    path = Path(args.csv_path)
    if not path.exists():
        raise SystemExit(f"CSV not found: {path}")

    sb = get_supabase(required=True)
    total = 0
    for batch in _chunks(_iter_rows(path, args.postcode_prefix), max(1, args.batch_size)):
        sb.table("ppd_sales").upsert(batch, on_conflict="transaction_id").execute()
        total += len(batch)
        print(f"Imported {total} rows...", flush=True)
    print(f"Done. Imported/upserted {total} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
