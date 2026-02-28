from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

MODEL_PATH = Path(os.getenv("SMART_SEARCH_MODEL_PATH", "models/search_rerank.json"))


@lru_cache(maxsize=1)
def get_model():
    try:
        import xgboost as xgb  # type: ignore[import-not-found]
    except Exception:
        return None

    path = MODEL_PATH
    if not path.exists():
        return None

    model = xgb.Booster()
    model.load_model(str(path))
    return model


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
    if not items or len(items) != len(feature_rows):
        return items

    scores = predict_scores(feature_rows)
    if len(scores) != len(items):
        return items

    ranked = sorted(zip(items, scores), key=lambda t: float(t[1]), reverse=True)
    return [item for item, _ in ranked]
