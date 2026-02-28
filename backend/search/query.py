from __future__ import annotations

import asyncio
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Sequence

_WORD_RE = re.compile(r"[a-z0-9-]+")
_STOP_WORDS = {
    "a",
    "an",
    "and",
    "for",
    "in",
    "of",
    "on",
    "the",
    "to",
    "with",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _synonyms_file() -> Path:
    return _repo_root() / "search" / "synonyms.yml"


@lru_cache(maxsize=1)
def _synonym_map() -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    path = _synonyms_file()
    if not path.exists():
        return out

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        terms = [t.strip().lower() for t in line.split(",") if t.strip()]
        if len(terms) < 2:
            continue

        group = set(terms)
        for term in group:
            out.setdefault(term, set()).update(group - {term})

    return out


def tokenize_query(query_text: str) -> list[str]:
    tokens = [t.lower() for t in _WORD_RE.findall(query_text or "")]
    return [t for t in tokens if t and t not in _STOP_WORDS]


def expand_query_terms(query_text: str) -> list[str]:
    tokens = tokenize_query(query_text)
    if not tokens:
        return []

    expanded: set[str] = set(tokens)
    syn_map = _synonym_map()

    for token in list(expanded):
        expanded.update(syn_map.get(token, set()))

    return sorted(expanded)


def _levenshtein_distance_leq_one(a: str, b: str) -> bool:
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False

    if la > lb:
        a, b = b, a
        la, lb = lb, la

    i = 0
    j = 0
    edits = 0
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1
            j += 1
            continue
        edits += 1
        if edits > 1:
            return False
        if la == lb:
            i += 1
            j += 1
        else:
            j += 1

    if j < lb or i < la:
        edits += 1

    return edits <= 1


def _listing_blob(listing: dict[str, Any]) -> str:
    fields: list[str] = []
    for key in ("title", "location", "description", "property_type", "investment_type"):
        value = listing.get(key)
        if isinstance(value, str) and value.strip():
            fields.append(value.strip().lower())

    for key in ("tags", "deal_signals", "deal_reasons"):
        value = listing.get(key)
        if isinstance(value, list):
            fields.extend(str(v).strip().lower() for v in value if str(v).strip())

    return " ".join(fields)


def query(query_text: str, listings: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    terms = expand_query_terms(query_text)
    if not terms:
        return list(listings)

    out: list[dict[str, Any]] = []
    for listing in listings:
        blob = _listing_blob(listing)
        words = _WORD_RE.findall(blob)
        if any(term in blob for term in terms):
            out.append(listing)
            continue

        if any(_levenshtein_distance_leq_one(word, term) for term in terms for word in words):
            out.append(listing)

    return out


def postgres_dsn() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("POSTGRES_DSN") or os.getenv("PG_DSN") or None


def is_postgres_detected() -> bool:
    return bool(postgres_dsn())


async def _fuzzy_ids_async(query_text: str, terms: Sequence[str], limit: int = 100) -> list[str]:
    dsn = postgres_dsn()
    if not dsn:
        return []

    try:
        import asyncpg  # type: ignore[import-not-found]
    except Exception:
        return []

    # Uses pg_trgm (%) and fuzzystrmatch (levenshtein_less_equal).
    sql = """
    SELECT id::text
    FROM properties
    WHERE (
      COALESCE(title, '') % $1
      OR COALESCE(location, '') % $1
      OR EXISTS (
        SELECT 1
                FROM regexp_split_to_table(lower(COALESCE(title, '') || ' ' || COALESCE(location, '')), E'\\W+') AS w,
             unnest($2::text[]) AS t
        WHERE w <> '' AND (w % t OR levenshtein_less_equal(w, t, 1) <= 1)
      )
    )
    ORDER BY GREATEST(
      similarity(COALESCE(title, ''), $1),
      similarity(COALESCE(location, ''), $1)
    ) DESC
    LIMIT $3
    """

    conn = await asyncpg.connect(dsn=dsn)
    try:
        rows = await conn.fetch(sql, (query_text or "").lower(), list(terms), int(limit))
    except Exception:
        return []
    finally:
        await conn.close()

    return [str(r["id"]) for r in rows if r.get("id")]


def fetch_postgres_fuzzy_ids(query_text: str, terms: Iterable[str], limit: int = 100) -> list[str]:
    term_list = [str(t).strip().lower() for t in terms if str(t).strip()]
    if not term_list:
        return []

    try:
        return asyncio.run(_fuzzy_ids_async(query_text=query_text, terms=term_list, limit=limit))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(
                _fuzzy_ids_async(query_text=query_text, terms=term_list, limit=limit)
            )
        finally:
            loop.close()
