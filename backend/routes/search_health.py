from __future__ import annotations

from fastapi import APIRouter

from backend.search.query import _postgres_url, is_postgres_detected

router = APIRouter(tags=["health"])


@router.get("/health/search")
def search_health() -> dict[str, object]:
    if not is_postgres_detected():
        return {
            "status": "skipped",
            "postgres_detected": False,
            "similarity_available": False,
            "detail": "Postgres URL is not configured.",
        }

    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(_postgres_url(), future=True)
        try:
            with engine.connect() as conn:
                score = conn.execute(
                    text("SELECT similarity('londn', 'london') AS score")
                ).scalar_one()
        finally:
            engine.dispose()

        return {
            "status": "ok",
            "postgres_detected": True,
            "similarity_available": True,
            "sample": {"lhs": "londn", "rhs": "london", "score": float(score)},
        }
    except Exception as exc:
        return {
            "status": "degraded",
            "postgres_detected": True,
            "similarity_available": False,
            "detail": str(exc),
        }
