from __future__ import annotations

import sys
from types import SimpleNamespace

from backend.ml import rerank


class _FailingBooster:
    calls = 0

    def load_model(self, _path: str) -> None:
        type(self).calls += 1
        raise ValueError("corrupt model")


class _OkBooster:
    def __init__(self) -> None:
        self.loaded_path: str | None = None

    def load_model(self, path: str) -> None:
        self.loaded_path = path


def _reset_cache() -> None:
    rerank._MODEL_CACHE = None
    rerank._MODEL_FAILED_MTIME = None


def test_get_model_handles_load_failure_without_raising(tmp_path, monkeypatch) -> None:
    bad_model = tmp_path / "bad.json"
    bad_model.write_text("broken")

    _reset_cache()
    _FailingBooster.calls = 0
    monkeypatch.setattr(rerank, "MODEL_PATH", bad_model)
    monkeypatch.setitem(sys.modules, "xgboost", SimpleNamespace(Booster=_FailingBooster))

    assert rerank.get_model() is None
    assert rerank.get_model() is None
    assert _FailingBooster.calls == 1


def test_get_model_retries_after_missing_file_appears(tmp_path, monkeypatch) -> None:
    model_path = tmp_path / "search_rerank.json"

    _reset_cache()
    monkeypatch.setattr(rerank, "MODEL_PATH", model_path)
    monkeypatch.setitem(sys.modules, "xgboost", SimpleNamespace(Booster=_OkBooster))

    assert rerank.get_model() is None

    model_path.write_text("ok")
    model = rerank.get_model()
    assert model is not None
