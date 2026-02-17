from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient


@dataclass
class _Res:
    data: Any


class _Query:
    def __init__(self, sb: "_FakeSupabase", table: str):
        self._sb = sb
        self._table = table
        self._gte: dict[str, str] = {}
        self._in: dict[str, list[Any]] = {}
        self._limit: int | None = None

    def select(self, _cols: str, **_kwargs):
        return self

    def gte(self, col: str, val: str):
        self._gte[str(col)] = str(val)
        return self

    def in_(self, col: str, vals):
        self._in[str(col)] = list(vals or [])
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, n: int):
        self._limit = int(n)
        return self

    def upsert(self, row, **_kwargs):
        self._sb._upserts.append((self._table, row))
        return self

    def execute(self):
        data = self._sb._execute(self._table, self._gte, self._in, self._limit)
        return _Res(data=data)


class _FakeSupabase:
    def __init__(self, *, now_iso: str):
        self._now_iso = now_iso
        self._upserts: list[tuple[str, Any]] = []

        # 5 newest rows in-window
        self._properties = [
            {"id": "00000000-0000-0000-0000-000000000001", "created_at": now_iso},
            {"id": "00000000-0000-0000-0000-000000000002", "created_at": now_iso},
            {"id": "00000000-0000-0000-0000-000000000003", "created_at": now_iso},
            {"id": "00000000-0000-0000-0000-000000000004", "created_at": now_iso},
            {"id": "00000000-0000-0000-0000-000000000005", "created_at": now_iso},
        ]

        # 1 recently enriched (exclude)
        self._cache = [
            {
                "property_id": "00000000-0000-0000-0000-000000000002",
                "fetched_at": now_iso,
            }
        ]

        # 1 recently queued pending (exclude)
        self._jobs = [
            {
                "property_id": "00000000-0000-0000-0000-000000000003",
                "status": "pending",
                "updated_at": now_iso,
            }
        ]

    def table(self, name: str):
        return _Query(self, str(name))

    def _execute(
        self,
        table: str,
        gte: dict[str, str],
        in_filters: dict[str, list[Any]],
        limit: int | None,
    ):
        if table == "properties":
            rows = list(self._properties)
        elif table == "property_enrichment_cache":
            rows = list(self._cache)
        elif table == "enrichment_jobs":
            rows = list(self._jobs)
        else:
            rows = []

        # Apply IN filters (only what we need for this test).
        for col, vals in in_filters.items():
            rows = [r for r in rows if r.get(col) in vals]

        # Apply GTE filters (lexicographic ISO works for our fixed ISO inputs).
        for col, cutoff in gte.items():
            rows = [r for r in rows if str(r.get(col) or "") >= str(cutoff)]

        if limit is not None:
            rows = rows[: int(limit)]
        return rows


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake_key")
    monkeypatch.setenv("OPENAI_API_KEY", "test_key")

    from backend.main import app

    return TestClient(app)


def test_enqueue_newest_daily_ok_and_capped(client, monkeypatch):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.enrichment_queue_routes as routes
    import backend.utils.enrichment_queue as eq

    fixed_now = datetime(2026, 2, 17, 0, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(eq, "_now_utc", lambda: fixed_now, raising=True)

    sb = _FakeSupabase(now_iso=fixed_now.isoformat())
    monkeypatch.setattr(routes, "get_supabase", lambda: sb, raising=True)

    resp = client.post(
        "/enrich/queue/enqueue-newest-daily?limit=2&hours=24",
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert data["enqueued"] <= 2
    assert data["eligible"] <= 2
