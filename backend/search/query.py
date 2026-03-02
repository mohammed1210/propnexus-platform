from __future__ import annotations

import difflib
import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.ml.rerank import rerank
from backend.search.synonyms import load_synonyms


def _normalize_text(v: Any) -> str:
    return str(v or "").strip().lower()


@lru_cache(maxsize=1)
def _synonym_map() -> dict[str, set[str]]:
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


def expand_query_terms(raw_query: str, max_terms: int = 30) -> list[str]:
    q = _normalize_text(raw_query)
    if not q:
        return []

    syn = _synonym_map()
    out: list[str] = []
    seen: set[str] = set()

    def _add(term: str) -> None:
        t = _normalize_text(term)
        if not t or t in seen:
            return
        seen.add(t)
        out.append(t)

    _add(q)
    for token in [t for t in q.replace("-", " ").split() if t.strip()]:
        _add(token)

    for key in list(out):
        for s in sorted(syn.get(key, set())):
            _add(s)
            if len(out) >= max_terms:
                return out[:max_terms]

    return out[:max_terms]


def _postgres_url() -> str:
    return str(
        os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRESQL_URL") or ""
    ).strip()


def is_postgres_detected() -> bool:
    url = _postgres_url().lower()
    return url.startswith("postgres://") or url.startswith("postgresql://")


def fetch_postgres_fuzzy_ids(
    raw_query: str, expanded_terms: list[str], limit: int = 50
) -> list[str]:
    if not is_postgres_detected():
        return []

    q = _normalize_text(raw_query)
    if not q:
        return []

    try:
        from sqlalchemy import create_engine, text
    except Exception:
        return []

    terms = [t for t in expanded_terms if _normalize_text(t)]
    if not terms:
        terms = [q]
    terms = terms[:20]

    params: dict[str, Any] = {
        "q": q,
        "limit": max(1, int(limit)),
    }

    like_clauses: list[str] = []
    for idx, term in enumerate(terms):
        key = f"t{idx}"
        params[key] = f"%{_normalize_text(term)}%"
        like_clauses.append(f"lower(title) LIKE :{key}")
        like_clauses.append(f"lower(location) LIKE :{key}")

    where_like = " OR ".join(like_clauses) if like_clauses else "FALSE"

    query_with_similarity = text(
        f"""
        SELECT id::text
        FROM properties
        WHERE ({where_like})
           OR similarity(lower(coalesce(title, '')), :q) >= 0.2
           OR similarity(lower(coalesce(location, '')), :q) >= 0.2
        ORDER BY GREATEST(
            similarity(lower(coalesce(title, '')), :q),
            similarity(lower(coalesce(location, '')), :q)
        ) DESC NULLS LAST,
        created_at DESC NULLS LAST
        LIMIT :limit
        """
    )

    query_without_similarity = text(
        f"""
        SELECT id::text
        FROM properties
        WHERE ({where_like})
        ORDER BY created_at DESC NULLS LAST
        LIMIT :limit
        """
    )

    engine = create_engine(_postgres_url(), future=True)
    try:
        with engine.connect() as conn:
            try:
                rows = conn.execute(query_with_similarity, params).fetchall()
            except Exception:
                rows = conn.execute(query_without_similarity, params).fetchall()
    except Exception:
        return []
    finally:
        try:
            engine.dispose()
        except Exception:
            pass

    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        rid = str(row[0] if isinstance(row, (list, tuple)) else row)
        if rid and rid not in seen:
            seen.add(rid)
            out.append(rid)
    return out


def _within_edit_distance_one(a: str, b: str) -> bool:
    a = _normalize_text(a)
    b = _normalize_text(b)
    if not a or not b:
        return False
    if abs(len(a) - len(b)) > 1:
        return False
    if a == b:
        return True

    i = j = 0
    edits = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1
            j += 1
            continue

        edits += 1
        if edits > 1:
            return False

        if len(a) > len(b):
            i += 1
        elif len(a) < len(b):
            j += 1
        else:
            i += 1
            j += 1

    if i < len(a) or j < len(b):
        edits += 1
    return edits <= 1


def _coerce_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _extract_range(filters: dict[str, Any], key: str) -> tuple[float | None, float | None]:
    raw = filters.get(key)
    if not isinstance(raw, dict):
        return (None, None)
    return (_coerce_optional_float(raw.get("gte")), _coerce_optional_float(raw.get("lte")))


def _matches_numeric_filters(row: dict[str, Any], filters: dict[str, Any]) -> bool:
    beds_gte, beds_lte = _extract_range(filters, "beds")
    price_gte, price_lte = _extract_range(filters, "price")
    yield_gte, yield_lte = _extract_range(filters, "yield")

    beds_val = _coerce_optional_float(row.get("bedrooms"))
    price_val = _coerce_optional_float(row.get("price"))
    row_yield = row.get("yield") if row.get("yield") is not None else row.get("yield_percent")
    yield_val = _coerce_optional_float(row_yield)

    if beds_gte is not None and (beds_val is None or beds_val < beds_gte):
        return False
    if beds_lte is not None and (beds_val is None or beds_val > beds_lte):
        return False

    if price_gte is not None and (price_val is None or price_val < price_gte):
        return False
    if price_lte is not None and (price_val is None or price_val > price_lte):
        return False

    if yield_gte is not None and (yield_val is None or yield_val < yield_gte):
        return False
    if yield_lte is not None and (yield_val is None or yield_val > yield_lte):
        return False

    return True


def build_search_where(payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    q = _normalize_text(payload.get("q"))
    filters = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}

    clauses: list[str] = ["1=1"]
    params: dict[str, Any] = {}

    if q:
        params["q"] = f"%{q}%"
        clauses.append(
            "(lower(coalesce(title, '')) LIKE :q OR lower(coalesce(location, '')) LIKE :q OR lower(coalesce(postcode, '')) LIKE :q)"
        )

    beds_gte, beds_lte = _extract_range(filters, "beds")
    if beds_gte is not None:
        clauses.append("bedrooms >= :beds_gte")
        params["beds_gte"] = beds_gte
    if beds_lte is not None:
        clauses.append("bedrooms <= :beds_lte")
        params["beds_lte"] = beds_lte

    price_gte, price_lte = _extract_range(filters, "price")
    if price_gte is not None:
        clauses.append("price >= :price_gte")
        params["price_gte"] = price_gte
    if price_lte is not None:
        clauses.append("price <= :price_lte")
        params["price_lte"] = price_lte

    yield_gte, yield_lte = _extract_range(filters, "yield")
    if yield_gte is not None:
        clauses.append("COALESCE(yield, yield_percent) >= :yield_gte")
        params["yield_gte"] = yield_gte
    if yield_lte is not None:
        clauses.append("COALESCE(yield, yield_percent) <= :yield_lte")
        params["yield_lte"] = yield_lte

    return " AND ".join(clauses), params


def query_db(payload: dict[str, Any]) -> dict[str, Any]:
    if not is_postgres_detected():
        return {"items": [], "total_results": 0}

    try:
        from sqlalchemy import create_engine, text
    except Exception:
        return {"items": [], "total_results": 0}

    safe_payload = payload if isinstance(payload, dict) else {}
    where_sql, params = build_search_where(safe_payload)
    limit = int(safe_payload.get("limit", 20) or 20)
    offset = int(safe_payload.get("offset", 0) or 0)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    params.update({"limit": limit, "offset": offset})

    stmt = text(
        f"""
        SELECT
            id::text,
            title,
            description,
            location,
            postcode,
            price,
            bedrooms,
            bathrooms,
            COALESCE(yield, yield_percent) AS yield,
            yield_percent,
            roi_percent,
            source,
            created_at,
            count(*) OVER() AS total_results
        FROM properties
        WHERE {where_sql}
        ORDER BY created_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
        """
    )

    engine = create_engine(_postgres_url(), future=True)
    rows: list[dict[str, Any]] = []
    total_results = 0
    try:
        with engine.connect() as conn:
            rs = conn.execute(stmt, params)
            for rec in rs.mappings().all():
                row = dict(rec)
                total_results = int(row.get("total_results") or 0)
                rows.append(row)
    except Exception:
        return {"items": [], "total_results": 0}
    finally:
        try:
            engine.dispose()
        except Exception:
            pass

    for row in rows:
        row.pop("total_results", None)

    # ──────────────── NEW: build match metadata ────────────────
    def find_matches(
        row: dict[str, Any], q_terms: list[str], syn: dict[str, set[str]]
    ) -> list[str]:
        title = str(row.get("title") or "").lower()
        description = str(row.get("description") or "").lower()
        tokens = re.split(r"[^\w]+", f"{title} {description}")
        out: list[str] = []

        for term in q_terms:
            if term in tokens:
                out.append(
                    f"keyword:title:{term}" if term in title else f"keyword:description:{term}"
                )
            for s in syn.get(term, set()):
                if s in tokens:
                    out.append(f"synonym:description:{s}")
            for tok in tokens:
                if tok and difflib.SequenceMatcher(None, term, tok).ratio() > 0.84:
                    out.append(f"fuzzy:{tok}")
                    break
        return out

    syn_map = load_synonyms()
    q_terms = str(safe_payload.get("q") or "").lower().split()
    for row in rows:
        row["matches"] = find_matches(row, q_terms, syn_map)

    return {"items": rows, "total_results": total_results}


def query(raw_query: str | dict[str, Any], listings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payload_mode = isinstance(raw_query, dict)
    payload = raw_query if payload_mode else None

    q = _normalize_text(payload.get("q") if payload_mode else raw_query)
    if not q:
        if payload_mode and isinstance(payload.get("filters"), dict):
            return [
                row
                for row in list(listings or [])
                if isinstance(row, dict)
                and _matches_numeric_filters(row, payload.get("filters", {}))
            ]
        return list(listings or [])

    filters = (
        payload.get("filters") if payload_mode and isinstance(payload.get("filters"), dict) else {}
    )

    expanded = expand_query_terms(q)
    if q not in expanded:
        expanded.insert(0, q)

    query_tokens = [t for t in q.replace("-", " ").split() if t.strip()]
    if not query_tokens:
        query_tokens = [q]

    results: list[dict[str, Any]] = []
    for row in listings or []:
        if not isinstance(row, dict):
            continue

        tags = row.get("tags")
        tags_text = " ".join(str(t) for t in tags) if isinstance(tags, list) else str(tags or "")
        haystack = " ".join(
            [
                _normalize_text(row.get("title")),
                _normalize_text(row.get("location")),
                _normalize_text(tags_text),
            ]
        ).strip()
        hay_tokens = [t for t in haystack.replace("-", " ").split() if t.strip()]

        matched = any(term in haystack for term in expanded)
        if not matched:
            for qt in query_tokens:
                if any(_within_edit_distance_one(qt, ht) for ht in hay_tokens):
                    matched = True
                    break

        if matched:
            if filters and not _matches_numeric_filters(row, filters):
                continue
            results.append(row)

    return results


def _trigrams(text: str) -> set[str]:
    s = f"  {text}  "
    return {s[i : i + 3] for i in range(max(len(s) - 2, 0))}


def trigram_similarity(a: str, b: str) -> float:
    ta = _trigrams(_normalize_text(a))
    tb = _trigrams(_normalize_text(b))
    if not ta or not tb:
        return 0.0
    return float(len(ta & tb) / max(len(ta | tb), 1))


def _coerce_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


def _age_days(created_at: Any) -> int:
    if not created_at:
        return 0
    if isinstance(created_at, str):
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            return 0
    elif isinstance(created_at, datetime):
        created = created_at
    else:
        return 0
    now = datetime.now(timezone.utc)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = now - created
    return max(int(delta.days), 0)


def build_feature_rows(query_text: str, candidates: list[dict[str, Any]]) -> list[list[float]]:
    prices = [_coerce_float(c.get("price"), default=0.0) for c in candidates]
    valid_prices = [p for p in prices if p > 0]
    sorted_prices = sorted(valid_prices)

    out: list[list[float]] = []
    q_norm = _normalize_text(query_text)

    for idx, c in enumerate(candidates):
        title = _normalize_text(c.get("title"))
        location = _normalize_text(c.get("location"))
        blob = f"{title} {location}".strip()

        exact_match = 1.0 if q_norm and q_norm in blob else 0.0
        trigram_sim = trigram_similarity(q_norm, blob)

        price = prices[idx]
        if price > 0 and sorted_prices:
            rank = sum(1 for p in sorted_prices if p <= price)
            price_rank_pct = rank / max(len(sorted_prices), 1)
        else:
            price_rank_pct = 0.0

        age_days = float(_age_days(c.get("created_at")))
        beds = _coerce_float(c.get("bedrooms"), default=0.0)
        yield_pct = _coerce_float(c.get("yield_percent"), default=0.0)

        out.append([exact_match, trigram_sim, price_rank_pct, age_days, beds, yield_pct])

    return out


def fetch_candidates(sb: Any, query_text: str, recall_limit: int = 100) -> list[dict[str, Any]]:
    q = _normalize_text(query_text)

    query = sb.table("properties").select("*").order("created_at", desc=True).limit(recall_limit)
    if q:
        safe_q = q.replace("%", "").replace(",", " ")
        query = query.or_(f"title.ilike.%{safe_q}%,location.ilike.%{safe_q}%")

    res = query.execute()
    rows = res.data or []
    if isinstance(rows, list):
        return [r for r in rows if isinstance(r, dict)]
    return []


def search_with_optional_rerank(
    sb: Any,
    query_text: str,
    *,
    top_k: int = 20,
    enable_ml: bool = False,
) -> list[dict[str, Any]]:
    recall = fetch_candidates(sb, query_text=query_text, recall_limit=100)
    if not recall:
        return []

    if enable_ml:
        features = build_feature_rows(query_text, recall)
        recall = rerank(recall, features)

    return recall[: max(int(top_k), 1)]
