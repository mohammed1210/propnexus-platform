from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

MODEL_PATH = Path(os.getenv("SMART_SEARCH_MODEL_PATH", "models/search_rerank.json"))
MODEL_BUCKET = os.getenv("ML_MODEL_BUCKET")
MODEL_PREFIX = os.getenv("SMART_SEARCH_MODEL_PREFIX", "search_rerank_")
_HOT_RELOAD_INTERVAL_SECONDS = float(os.getenv("SMART_SEARCH_MODEL_POLL_SECONDS", "30"))
_MODEL_CACHE: tuple[int, Any] | None = None
_MODEL_FAILED_MTIME: int | None = None
_last_loaded_ts: float = 0.0
_last_checked_ts: float = 0.0

logger = logging.getLogger(__name__)


def get_model():
    global _MODEL_CACHE, _MODEL_FAILED_MTIME

    try:
        import xgboost as xgb  # type: ignore[import-not-found]
    except Exception:
        return None

    path = MODEL_PATH
    try:
        mtime = path.stat().st_mtime_ns
    except FileNotFoundError:
        _MODEL_CACHE = None
        _MODEL_FAILED_MTIME = None
        return None

    if _MODEL_CACHE is not None and _MODEL_CACHE[0] == mtime:
        return _MODEL_CACHE[1]
    if _MODEL_FAILED_MTIME == mtime:
        return None

    model = xgb.Booster()
    try:
        model.load_model(str(path))
    except Exception:
        _MODEL_CACHE = None
        _MODEL_FAILED_MTIME = mtime
        return None

    _MODEL_CACHE = (mtime, model)
    _MODEL_FAILED_MTIME = None
    return model


def hot_reload_if_new() -> None:
    global _last_loaded_ts, _last_checked_ts

    if not MODEL_BUCKET:
        return

    now = time.time()
    if (now - _last_checked_ts) < _HOT_RELOAD_INTERVAL_SECONDS:
        return
    _last_checked_ts = now

    try:
        import boto3
    except Exception:
        return

    try:
        s3 = boto3.client("s3")
        objs = s3.list_objects_v2(Bucket=MODEL_BUCKET, Prefix=MODEL_PREFIX).get("Contents", [])
        candidates = [o for o in objs if str(o.get("Key", "")).endswith(".json")]
        if not candidates:
            return

        latest = max(candidates, key=lambda o: o["LastModified"])
        ts = latest["LastModified"].timestamp()
        key = str(latest["Key"])

        if ts <= _last_loaded_ts:
            return

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        s3.download_file(MODEL_BUCKET, key, str(MODEL_PATH))

        global _MODEL_CACHE, _MODEL_FAILED_MTIME
        _MODEL_CACHE = None
        _MODEL_FAILED_MTIME = None
        _last_loaded_ts = ts
        logger.info("Loaded newer rerank model: %s", key)
    except Exception as exc:
        logger.warning("Rerank hot reload skipped: %s", exc)


def predict_scores(feature_rows: list[list[float]]) -> list[float]:
    model = get_model()
    if model is None or not feature_rows:
        return [0.0 for _ in feature_rows]

    try:
        import xgboost as xgb  # type: ignore[import-not-found]
    except Exception:
        return [0.0 for _ in feature_rows]

    dm = xgb.DMatrix(feature_rows)
    preds = model.predict(dm)
    return [float(v) for v in preds]


def rerank(items: list[dict[str, Any]], feature_rows: list[list[float]]) -> list[dict[str, Any]]:
    hot_reload_if_new()

    if not items or len(items) != len(feature_rows):
        return items

    scores = predict_scores(feature_rows)
    if len(scores) != len(items):
        return items

    ranked = sorted(zip(items, scores), key=lambda t: float(t[1]), reverse=True)
    return [item for item, _ in ranked]
