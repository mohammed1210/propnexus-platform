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

import boto3
import lightgbm as lgb
import pandas as pd
import psycopg2

SUPABASE_URL = os.environ["SUPABASE_URL_RW"]
S3_BUCKET = os.environ["ML_MODEL_BUCKET"]

CLICK_SQL = """
select query, listing_id, rank, clicked_at
from analytics.search_clicks
where clicked_at >= now() - interval '14 days';
"""

FEATURE_SQL = """
select listing_id, price, "yield" as yield_value, tfidf
from features.listing_vectors
"""


def fetch_clicks() -> pd.DataFrame:
    conn = psycopg2.connect(SUPABASE_URL)
    try:
        return pd.read_sql(CLICK_SQL, conn)
    finally:
        conn.close()


def build_dataset(df: pd.DataFrame) -> pd.DataFrame:
    conn = psycopg2.connect(SUPABASE_URL)
    try:
        feats = pd.read_sql(FEATURE_SQL, conn)
    finally:
        conn.close()

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
