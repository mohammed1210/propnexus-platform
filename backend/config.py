from __future__ import annotations

import os


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    SMART_SEARCH_ML_RERANK: bool = _env_bool("SMART_SEARCH_ML_RERANK", False)


settings = Settings()
