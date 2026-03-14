from __future__ import annotations

import argparse
import io
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _parse_date(value: str | None) -> date:
    if value:
        return datetime.strptime(value, "%Y-%m-%d").date()
    return (datetime.now(timezone.utc) - timedelta(days=1)).date()


def _to_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        text = text.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(text)
        except Exception:
            return None
    return None


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _trigrams(text: str) -> set[str]:
    s = f"  {text}  "
    return {s[i : i + 3] for i in range(max(len(s) - 2, 0))}


def _trigram_similarity(a: str, b: str) -> float:
    ta = _trigrams(_normalize_text(a))
    tb = _trigrams(_normalize_text(b))
    if not ta or not tb:
        return 0.0
    inter = len(ta.intersection(tb))
    denom = len(ta.union(tb))
    if denom <= 0:
        return 0.0
    return float(inter / denom)


@dataclass
class OutputPath:
    bucket: str | None
    key: str
    local_path: Path | None


def _resolve_output(output_prefix: str, run_date: date) -> OutputPath:
    suffix = f"date={run_date.isoformat()}/part-00000.parquet"
    if output_prefix.startswith("s3://"):
        parsed = urlparse(output_prefix)
        bucket = parsed.netloc
        base = parsed.path.lstrip("/").rstrip("/")
        key = f"{base}/{suffix}" if base else suffix
        return OutputPath(bucket=bucket, key=key, local_path=None)

    base_path = Path(output_prefix) / f"date={run_date.isoformat()}"
    base_path.mkdir(parents=True, exist_ok=True)
    local_path = base_path / "part-00000.parquet"
    return OutputPath(bucket=None, key=str(local_path), local_path=local_path)


def _fetch_click_rows(run_date: date) -> list[dict[str, Any]]:
    dsn = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_URL_RW")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRESQL_URL")
        or os.getenv("POSTGRES_DSN")
        or os.getenv("PG_DSN")
    )
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL (or SUPABASE_URL_RW/POSTGRES_URL/POSTGRESQL_URL/POSTGRES_DSN/PG_DSN) is required"
        )

    try:
        import asyncpg  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("asyncpg is required for ETL") from e

    async def _run() -> list[dict[str, Any]]:
        conn = await asyncpg.connect(dsn=dsn)
        try:
            col_rows = await conn.fetch(
                """
                select column_name
                from information_schema.columns
                where table_schema = 'analytics'
                  and table_name = 'search_clicks'
                """
            )
            cols = {str(r["column_name"]) for r in col_rows}
            if not cols:
                raise RuntimeError("analytics.search_clicks not found")

            clicked_col = "created_at" if "created_at" in cols else None
            if clicked_col is None and "inserted_at" in cols:
                clicked_col = "inserted_at"
            if clicked_col is None:
                raise RuntimeError("analytics.search_clicks has neither created_at nor inserted_at")

            query_expr = "sc.query" if "query" in cols else "''"
            if "query" not in cols:
                # Legacy fallback where query text was embedded in row json.
                query_expr = "COALESCE(to_jsonb(sc)->>'query_text', '')"

            listing_expr = "sc.listing_id::text" if "listing_id" in cols else "sc.property_id::text"
            join_expr = "p.id = sc.listing_id" if "listing_id" in cols else "p.id = sc.property_id"
            user_expr = "sc.user_id::text" if "user_id" in cols else "NULL::text"
            rank_expr = (
                "sc.rank" if "rank" in cols else ("sc.position" if "position" in cols else "NULL")
            )
            query_id_expr = "sc.query_id::text" if "query_id" in cols else "NULL::text"

            sql = f"""
                SELECT
                  sc.id::text AS click_id,
                  {query_id_expr} AS query_id,
                  {listing_expr} AS listing_id,
                  {user_expr} AS user_id,
                  {rank_expr} AS rank,
                  sc.{clicked_col} AS clicked_at,
                  {query_expr} AS query_text,
                  p.title AS title,
                  p.location AS location,
                  p.price AS price,
                  p.bedrooms AS beds,
                  p.yield_percent AS yield,
                  p.created_at AS listing_created_at
                FROM analytics.search_clicks sc
                LEFT JOIN properties p ON {join_expr}
                WHERE DATE(sc.{clicked_col} AT TIME ZONE 'UTC') = $1::date
            """

            rows = await conn.fetch(sql, run_date.isoformat())
            return [dict(r) for r in rows]
        finally:
            await conn.close()

    import asyncio

    return asyncio.run(_run())


def _build_feature_frame(rows: list[dict[str, Any]]):
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("pandas is required for ETL") from e

    if not rows:
        return pd.DataFrame(
            columns=[
                "query_id",
                "listing_id",
                "exact_match",
                "trigram_sim",
                "price_rank_pct",
                "age_days",
                "beds",
                "yield",
                "user_clicked",
                "event_date",
            ]
        )

    df = pd.DataFrame(rows)
    df["query_text_norm"] = df["query_text"].fillna("").astype(str).str.strip().str.lower()
    df["title_norm"] = df["title"].fillna("").astype(str).str.strip().str.lower()
    df["loc_norm"] = df["location"].fillna("").astype(str).str.strip().str.lower()

    df["exact_match"] = (df["query_text_norm"] != "") & (
        df.apply(
            lambda r: (r["query_text_norm"] in r["title_norm"])
            or (r["query_text_norm"] in r["loc_norm"]),
            axis=1,
        )
    )

    df["trigram_sim"] = df.apply(
        lambda r: _trigram_similarity(r["query_text_norm"], f"{r['title_norm']} {r['loc_norm']}"),
        axis=1,
    )

    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["price_rank_pct"] = (
        df.groupby("query_id")["price"].rank(method="average", pct=True, ascending=True).fillna(0.0)
    )

    clicked_at = pd.to_datetime(df["clicked_at"], errors="coerce", utc=True)
    listing_created_at = pd.to_datetime(df["listing_created_at"], errors="coerce", utc=True)
    age_days = (clicked_at - listing_created_at).dt.days
    df["age_days"] = age_days.fillna(0).clip(lower=0).astype(int)

    df["beds"] = pd.to_numeric(df["beds"], errors="coerce").fillna(0).astype(int)
    df["yield"] = pd.to_numeric(df["yield"], errors="coerce").fillna(0.0).astype(float)

    df["user_clicked"] = 1
    df["event_date"] = clicked_at.dt.date.astype(str)

    return df[
        [
            "query_id",
            "listing_id",
            "exact_match",
            "trigram_sim",
            "price_rank_pct",
            "age_days",
            "beds",
            "yield",
            "user_clicked",
            "event_date",
        ]
    ]


def _write_parquet(df, output: OutputPath) -> str:
    try:
        import pyarrow as pa  # type: ignore[import-not-found]
        import pyarrow.parquet as pq  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("pyarrow is required for ETL") from e

    table = pa.Table.from_pandas(df, preserve_index=False)

    if output.local_path is not None:
        pq.write_table(table, output.local_path)
        return str(output.local_path)

    sink = io.BytesIO()
    pq.write_table(table, sink)

    try:
        import boto3  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("boto3 is required for S3 upload") from e

    s3 = boto3.client("s3")
    s3.put_object(Bucket=str(output.bucket), Key=output.key, Body=sink.getvalue())
    return f"s3://{output.bucket}/{output.key}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Smart-Search click features parquet")
    parser.add_argument(
        "--date", default=None, help="UTC date in YYYY-MM-DD (defaults to yesterday)"
    )
    parser.add_argument(
        "--output-prefix",
        default=os.getenv("SMART_SEARCH_FEATURES_PREFIX", "s3://propnexus-ml/features"),
        help="Output prefix (S3 or local path)",
    )
    args = parser.parse_args()

    run_date = _parse_date(args.date)
    rows = _fetch_click_rows(run_date)
    frame = _build_feature_frame(rows)
    output = _resolve_output(args.output_prefix, run_date)
    destination = _write_parquet(frame, output)

    print(
        f"Wrote {len(frame)} rows for date={run_date.isoformat()} to {destination}",
    )


if __name__ == "__main__":
    main()
