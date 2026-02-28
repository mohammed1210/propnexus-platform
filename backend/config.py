from __future__ import annotations

import os


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    SMART_SEARCH_SYNONYMS: bool = _env_bool("SMART_SEARCH_SYNONYMS", True)


settings = Settings()
