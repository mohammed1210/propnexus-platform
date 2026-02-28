from __future__ import annotations

import math

import pytest


def _dcg(rels: list[float], k: int) -> float:
    out = 0.0
    for i, rel in enumerate(rels[:k], start=1):
        out += (2.0**rel - 1.0) / math.log2(i + 1.0)
    return out


def _ndcg_at_10(y_true: list[int], y_pred: list[float], qids: list[str]) -> float:
    by_q: dict[str, list[tuple[int, float]]] = {}
    for yt, yp, q in zip(y_true, y_pred, qids):
        by_q.setdefault(q, []).append((int(yt), float(yp)))

    scores = []
    for pairs in by_q.values():
        ranked = [p[0] for p in sorted(pairs, key=lambda t: t[1], reverse=True)]
        ideal = sorted((p[0] for p in pairs), reverse=True)
        denom = _dcg(ideal, 10)
        if denom > 0:
            scores.append(_dcg(ranked, 10) / denom)

    return sum(scores) / len(scores) if scores else 0.0


@pytest.mark.filterwarnings("ignore::UserWarning")
def test_rerank_ndcg10_beats_baseline_stub() -> None:
    try:
        import xgboost as xgb  # type: ignore[import-not-found]
    except Exception:
        pytest.skip("xgboost not installed")

    # Synthetic groups where trigram/exact match are key relevance signals.
    qids: list[str] = []
    X: list[list[float]] = []
    y: list[int] = []

    for q in range(1, 31):
        qid = f"q{q}"
        # relevant
        X.append([1.0, 0.92, 0.45, 15.0, 2.0, 7.5])
        y.append(1)
        qids.append(qid)

        # non-relevant distractors
        X.append([0.0, 0.18, 0.85, 5.0, 4.0, 2.1])
        y.append(0)
        qids.append(qid)

        X.append([0.0, 0.10, 0.15, 120.0, 1.0, 1.2])
        y.append(0)
        qids.append(qid)

    split_group = 24
    train_rows = split_group * 3

    X_train = X[:train_rows]
    y_train = y[:train_rows]
    group_train = [3] * split_group

    X_test = X[train_rows:]
    y_test = y[train_rows:]
    q_test = qids[train_rows:]

    ranker = xgb.sklearn.XGBRanker(
        objective="rank:ndcg",
        n_estimators=40,
        max_depth=4,
        learning_rate=0.15,
        subsample=1.0,
        colsample_bytree=1.0,
        random_state=42,
    )
    ranker.fit(X_train, y_train, group=group_train, verbose=False)

    # Baseline stub: use inverse price_rank_pct only.
    baseline_pred = [-row[2] for row in X_test]
    baseline_ndcg = _ndcg_at_10(y_test, baseline_pred, q_test)

    model_pred = ranker.predict(X_test).tolist()
    model_ndcg = _ndcg_at_10(y_test, model_pred, q_test)

    assert model_ndcg > baseline_ndcg
