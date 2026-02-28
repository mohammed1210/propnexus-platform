from __future__ import annotations

import argparse
import io
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

FEATURE_COLUMNS = ["exact_match", "trigram_sim", "price_rank_pct", "age_days", "beds", "yield"]


@dataclass
class EvalMetrics:
    ndcg_at_10: float
    map_at_10: float


def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _dcg(rels: list[float], k: int) -> float:
    import math

    out = 0.0
    for i, rel in enumerate(rels[:k], start=1):
        out += (2.0**rel - 1.0) / math.log2(i + 1.0)
    return out


def _ndcg_at_k(y_true: list[float], y_pred: list[float], qids: list[str], k: int = 10) -> float:
    by_q: dict[str, list[tuple[float, float]]] = {}
    for yt, yp, qid in zip(y_true, y_pred, qids):
        by_q.setdefault(str(qid), []).append((float(yt), float(yp)))

    if not by_q:
        return 0.0

    scores: list[float] = []
    for pairs in by_q.values():
        sorted_by_pred = [p[0] for p in sorted(pairs, key=lambda t: t[1], reverse=True)]
        ideal = sorted((p[0] for p in pairs), reverse=True)
        denom = _dcg(ideal, k)
        if denom <= 0:
            continue
        scores.append(_dcg(sorted_by_pred, k) / denom)

    return sum(scores) / len(scores) if scores else 0.0


def _map_at_k(y_true: list[float], y_pred: list[float], qids: list[str], k: int = 10) -> float:
    by_q: dict[str, list[tuple[float, float]]] = {}
    for yt, yp, qid in zip(y_true, y_pred, qids):
        by_q.setdefault(str(qid), []).append((float(yt), float(yp)))

    if not by_q:
        return 0.0

    aps: list[float] = []
    for pairs in by_q.values():
        relevant_count = sum(1 for label, _ in pairs if label > 0)
        denom = min(k, relevant_count)
        if denom <= 0:
            aps.append(0.0)
            continue

        ranked = sorted(pairs, key=lambda t: t[1], reverse=True)[:k]
        hits = 0
        precisions = []
        for i, (label, _) in enumerate(ranked, start=1):
            if label > 0:
                hits += 1
                precisions.append(hits / i)
        aps.append(sum(precisions) / denom if precisions else 0.0)
    return sum(aps) / len(aps)


def _list_s3_objects(prefix: str, day_keys: Iterable[str]) -> list[tuple[str, str]]:
    try:
        import boto3  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("boto3 is required to read S3 parquet") from e

    parsed = urlparse(prefix)
    bucket = parsed.netloc
    base = parsed.path.lstrip("/").rstrip("/")

    s3 = boto3.client("s3")
    out: list[tuple[str, str]] = []
    for day in day_keys:
        pfx = f"{base}/date={day}/"
        token = None
        while True:
            kwargs = {"Bucket": bucket, "Prefix": pfx}
            if token:
                kwargs["ContinuationToken"] = token
            res = s3.list_objects_v2(**kwargs)
            for obj in res.get("Contents", []):
                key = obj.get("Key", "")
                if key.endswith(".parquet"):
                    out.append((bucket, key))
            if not res.get("IsTruncated"):
                break
            token = res.get("NextContinuationToken")
    return out


def _read_parquet_from_s3(prefix: str, day_keys: Iterable[str]):
    try:
        import boto3  # type: ignore[import-not-found]
        import pandas as pd  # type: ignore[import-not-found]
        import pyarrow.parquet as pq  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("boto3, pandas and pyarrow are required") from e

    s3 = boto3.client("s3")
    frames = []
    for bucket, key in _list_s3_objects(prefix, day_keys):
        obj = s3.get_object(Bucket=bucket, Key=key)
        body = obj["Body"].read()
        table = pq.read_table(io.BytesIO(body))
        frames.append(table.to_pandas())

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _read_parquet_from_local(prefix: str, day_keys: Iterable[str]):
    try:
        import pandas as pd  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("pandas is required") from e

    base = Path(prefix)
    frames = []
    for day in day_keys:
        day_dir = base / f"date={day}"
        if not day_dir.exists():
            continue
        for part in sorted(day_dir.glob("*.parquet")):
            frames.append(pd.read_parquet(part))

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def load_feature_frame(days: int, prefix: str):
    end_day = datetime.now(timezone.utc).date() - timedelta(days=1)
    day_keys = [(end_day - timedelta(days=i)).isoformat() for i in range(max(days, 1))]

    if prefix.startswith("s3://"):
        return _read_parquet_from_s3(prefix, day_keys)
    return _read_parquet_from_local(prefix, day_keys)


def _augment_with_negatives(df):
    import pandas as pd  # type: ignore[import-not-found]

    if df.empty:
        return df

    rows = []
    for qid, group in df.groupby("query_id"):
        g = group.copy()
        g["user_clicked"] = g["user_clicked"].fillna(1).astype(int)
        rows.append(g)
        # Synthetic negatives if only positives exist.
        if int(g["user_clicked"].sum()) == len(g):
            neg = g.head(min(3, len(g))).copy()
            neg["user_clicked"] = 0
            neg["trigram_sim"] = (neg["trigram_sim"].astype(float) * 0.5).clip(lower=0.0)
            neg["exact_match"] = False
            neg["price_rank_pct"] = (1.0 - neg["price_rank_pct"].astype(float)).clip(0.0, 1.0)
            rows.append(neg)

    return pd.concat(rows, ignore_index=True)


def _prepare_matrix(df):
    import pandas as pd  # type: ignore[import-not-found]

    out = df.copy()
    out["exact_match"] = out["exact_match"].astype(int)
    for col in FEATURE_COLUMNS:
        if col not in out.columns:
            out[col] = 0.0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)
    out["user_clicked"] = (
        pd.to_numeric(out.get("user_clicked", 0), errors="coerce").fillna(0).astype(int)
    )
    out["query_id"] = out["query_id"].astype(str)
    return out


def _split_by_query(df, frac: float = 0.8):
    qids = sorted(df["query_id"].unique().tolist())
    if not qids:
        return df.copy(), df.iloc[0:0].copy()

    if len(qids) == 1:
        train_df = df.copy()
        test_df = df.iloc[0:0].copy()
        return train_df, test_df

    split = max(1, min(len(qids) - 1, int(len(qids) * frac)))
    train_qids = set(qids[:split])
    train_df = df[df["query_id"].isin(train_qids)].copy()
    test_df = df[~df["query_id"].isin(train_qids)].copy()
    return train_df, test_df


def train(days: int, output: str, features_prefix: str) -> EvalMetrics:
    try:
        import xgboost as xgb  # type: ignore[import-not-found]
    except Exception as e:
        raise RuntimeError("xgboost is required for training") from e

    frame = load_feature_frame(days=days, prefix=features_prefix)
    if frame.empty:
        raise RuntimeError("No feature parquet rows found for requested period")

    frame = _augment_with_negatives(frame)
    frame = _prepare_matrix(frame)
    train_df, test_df = _split_by_query(frame, frac=0.8)

    X_train = train_df[FEATURE_COLUMNS]
    y_train = train_df["user_clicked"]
    group_train = train_df.groupby("query_id").size().tolist()

    has_holdout = not test_df.empty

    ranker = xgb.sklearn.XGBRanker(
        objective="rank:ndcg",
        n_estimators=80,
        learning_rate=0.1,
        max_depth=6,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    ranker.fit(X_train, y_train, group=group_train, verbose=False)

    Path(output).parent.mkdir(parents=True, exist_ok=True)
    ranker.save_model(output)

    if has_holdout:
        X_test = test_df[FEATURE_COLUMNS]
        y_test = test_df["user_clicked"].tolist()
        q_test = test_df["query_id"].tolist()
        y_pred = ranker.predict(X_test).tolist()
        metrics = EvalMetrics(
            ndcg_at_10=_ndcg_at_k(y_true=y_test, y_pred=y_pred, qids=q_test, k=10),
            map_at_10=_map_at_k(y_true=y_test, y_pred=y_pred, qids=q_test, k=10),
        )
    else:
        metrics = EvalMetrics(ndcg_at_10=0.0, map_at_10=0.0)

    print("| metric | value |")
    print("|---|---:|")
    print(f"| NDCG@10 | {metrics.ndcg_at_10:.4f} |")
    print(f"| MAP@10 | {metrics.map_at_10:.4f} |")
    if not has_holdout:
        print("| NOTE | holdout split unavailable (single query_id); metrics set to 0.0000 |")

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Smart-Search rerank model")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--output", default="models/search_rerank.json")
    parser.add_argument(
        "--features-prefix",
        default=os.getenv("SMART_SEARCH_FEATURES_PREFIX", "s3://propnexus-ml/features"),
    )
    args = parser.parse_args()

    train(days=args.days, output=args.output, features_prefix=args.features_prefix)


if __name__ == "__main__":
    main()
