#!/usr/bin/env python
"""
Nightly job: train LambdaMART rerank model from last-14-day click logs.
Outputs a model json + metrics json.
"""

from __future__ import annotations

import datetime as dt
import json
import os
from io import BytesIO
from typing import Iterable

import boto3
import lightgbm as lgb
import pandas as pd
import psycopg2

SUPABASE_URL = os.environ["SUPABASE_URL_RW"]
S3_BUCKET = os.environ["ML_MODEL_BUCKET"]


def _table_columns(conn, schema: str, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name
            from information_schema.columns
            where table_schema = %s and table_name = %s
            """,
            (schema, table),
        )
        return {r[0] for r in cur.fetchall()}


def _first_existing_table(
    conn, candidates: Iterable[tuple[str, str]]
) -> tuple[str, str, set[str]] | None:
    for schema, table in candidates:
        cols = _table_columns(conn, schema, table)
        if cols:
            return schema, table, cols
    return None


def _build_click_sql(schema: str, table: str, cols: set[str]) -> str:
    query_expr = "query" if "query" in cols else ("query_id::text" if "query_id" in cols else "''")

    if "property_id" in cols:
        listing_expr = "property_id"
    elif "listing_id" in cols:
        listing_expr = "listing_id"
    else:
        raise RuntimeError(f"{schema}.{table} is missing property_id/listing_id column")

    rank_expr = "position" if "position" in cols else ("rank" if "rank" in cols else "0")

    if "created_at" in cols:
        time_expr = "created_at"
    elif "clicked_at" in cols:
        time_expr = "clicked_at"
    elif "inserted_at" in cols:
        time_expr = "inserted_at"
    else:
        raise RuntimeError(f"{schema}.{table} is missing created_at/clicked_at/inserted_at column")

    return f"""
select
  {query_expr} as query,
  {listing_expr} as listing_id,
  {rank_expr} as rank,
  {time_expr} as clicked_at
from {schema}.{table}
where {time_expr} >= now() - interval '14 days';
"""


def _build_feature_sql(schema: str, table: str, cols: set[str]) -> str:
    if "listing_id" in cols:
        listing_expr = "listing_id"
    elif "property_id" in cols:
        listing_expr = "property_id"
    elif "id" in cols:
        listing_expr = "id"
    else:
        raise RuntimeError(f"{schema}.{table} is missing listing_id/property_id/id column")

    if "price" not in cols:
        raise RuntimeError(f"{schema}.{table} is missing price column")

    if "yield_value" in cols:
        yield_expr = "yield_value"
    elif "yield_percent" in cols:
        yield_expr = "yield_percent"
    elif "yield" in cols:
        yield_expr = '"yield"'
    else:
        yield_expr = "0::numeric"

    tfidf_expr = "tfidf" if "tfidf" in cols else "0::numeric"

    return f"""
select
  {listing_expr} as listing_id,
  price,
  {yield_expr} as yield_value,
  {tfidf_expr} as tfidf
from {schema}.{table};
"""


def fetch_clicks() -> pd.DataFrame:
    conn = psycopg2.connect(SUPABASE_URL)
    try:
        match = _first_existing_table(
            conn,
            [
                ("analytics", "search_clicks"),
                ("public", "search_clicks"),
            ],
        )
        if not match:
            raise RuntimeError(
                "No search_clicks table found (checked analytics.search_clicks, public.search_clicks)"
            )

        schema, table, cols = match
        click_sql = _build_click_sql(schema, table, cols)
        print(f"Using click table: {schema}.{table}")
        return pd.read_sql(click_sql, conn)
    finally:
        conn.close()


def build_dataset(df: pd.DataFrame) -> pd.DataFrame:
    conn = psycopg2.connect(SUPABASE_URL)
    try:
        match = _first_existing_table(
            conn,
            [
                ("features", "listing_vectors"),
                ("public", "listing_vectors"),
                ("public", "properties"),
            ],
        )
        if not match:
            raise RuntimeError(
                "No feature table found (checked features.listing_vectors, public.listing_vectors, public.properties)"
            )

        schema, table, cols = match
        feature_sql = _build_feature_sql(schema, table, cols)
        print(f"Using feature table: {schema}.{table}")
        feats = pd.read_sql(feature_sql, conn)
    finally:
        conn.close()

    df = df.copy()
    df["listing_id"] = df["listing_id"].astype(str)
    feats["listing_id"] = feats["listing_id"].astype(str)

    merged = df.merge(feats, on="listing_id", how="inner")
    merged = merged.dropna(subset=["query", "price", "yield_value", "tfidf", "rank"])

    rank_numeric = pd.to_numeric(merged["rank"], errors="coerce").fillna(100.0)
    max_rank = float(rank_numeric.max()) if len(rank_numeric) else 100.0
    merged["label"] = (max_rank - rank_numeric + 1.0).clip(lower=1.0)
    return merged


def train(df: pd.DataFrame):
    features = ["price", "yield_value", "tfidf"]
    grouped = df.groupby("query", sort=False).size().tolist()

    dtrain = lgb.Dataset(df[features], label=df["label"], group=grouped)
    params = {
        "objective": "lambdarank",
        "metric": "ndcg",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 20,
        "verbosity": -1,
    }
    model = lgb.train(params, dtrain, num_boost_round=100)
    metrics = {
        "num_rows": int(len(df)),
        "num_queries": int(df["query"].nunique()),
    }
    return model, metrics


def upload(model: lgb.Booster, metrics: dict) -> str:
    s3 = boto3.client("s3")
    ts = dt.datetime.utcnow().strftime("%Y%m%d%H%M")
    key = f"search_rerank_{ts}.json"

    model_json = json.dumps(model.dump_model()).encode("utf-8")
    buf = BytesIO(model_json)
    s3.upload_fileobj(buf, S3_BUCKET, key, ExtraArgs={"ContentType": "application/json"})
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"{key}.metrics",
        Body=json.dumps(metrics).encode("utf-8"),
        ContentType="application/json",
    )
    return key


def main() -> None:
    df = fetch_clicks()
    if len(df) < 500:
        print("Not enough clicks, aborting")
        return

    data = build_dataset(df)
    if len(data) < 200:
        print("Not enough joined feature rows, aborting")
        return

    model, metrics = train(data)
    key = upload(model, metrics)
    print("uploaded", key, metrics)


if __name__ == "__main__":
    main()
