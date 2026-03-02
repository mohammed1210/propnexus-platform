from __future__ import annotations

from functools import lru_cache
from pathlib import Path


def _normalize_text(v: str) -> str:
    return str(v or "").strip().lower()


@lru_cache(maxsize=1)
def load_synonyms() -> dict[str, set[str]]:
    path = Path(__file__).resolve().parents[2] / "search" / "synonyms.yml"
    mapping: dict[str, set[str]] = {}

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return mapping

    for raw_line in lines:
        line = str(raw_line or "").strip()
        if not line or line.startswith("#"):
            continue
        terms = [_normalize_text(p) for p in line.split(",") if _normalize_text(p)]
        if len(terms) < 2:
            continue
        group = set(terms)
        for term in group:
            mapping.setdefault(term, set()).update(group)

    return mapping
