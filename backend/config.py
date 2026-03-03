from __future__ import annotations

import os


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(str(raw).strip())
    except Exception:
        return default


class Settings:
    SMART_SEARCH_SYNONYMS: bool = _env_bool("SMART_SEARCH_SYNONYMS", True)
    SMART_SEARCH_ML_RERANK: bool = _env_bool("SMART_SEARCH_ML_RERANK", False)
    SMART_SEARCH_ML_5XX_SPIKE_THRESHOLD: int = _env_int("SMART_SEARCH_ML_5XX_SPIKE_THRESHOLD", 3)
    SMART_SEARCH_ML_5XX_SPIKE_WINDOW_SECONDS: int = _env_int(
        "SMART_SEARCH_ML_5XX_SPIKE_WINDOW_SECONDS", 300
    )
    SMART_SEARCH_ML_FALLBACK_COOLDOWN_SECONDS: int = _env_int(
        "SMART_SEARCH_ML_FALLBACK_COOLDOWN_SECONDS", 600
    )


settings = Settings()
