import pytest
from fastapi.testclient import TestClient


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, store: dict[str, dict], name: str):
        self._store = store
        self._name = name
        self._op = None
        self._payload = None
        self._cols = None
        self._eq_key = None
        self._eq_val = None

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def select(self, cols):
        self._op = "select"
        self._cols = cols
        return self

    def eq(self, key, val):
        self._eq_key = key
        self._eq_val = val
        return self

    def execute(self):
        if self._name != "scrape_runs":
            return _FakeResult([])

        if self._op == "insert":
            payload = dict(self._payload or {})
            rid = str(payload.get("id"))
            self._store[rid] = {
                "id": rid,
                "status": payload.get("status"),
                "count_inserted": payload.get("count_inserted") or 0,
                "error": payload.get("error"),
                "data": payload.get("data"),
            }
            return _FakeResult([self._store[rid]])

        if self._op == "update":
            rid = str(self._eq_val)
            row = self._store.get(rid) or {"id": rid}
            row.update(dict(self._payload or {}))
            self._store[rid] = row
            return _FakeResult([row])

        if self._op == "select":
            rid = str(self._eq_val)
            row = self._store.get(rid)
            return _FakeResult([row] if isinstance(row, dict) else [])

        return _FakeResult([])


class _FakeSB:
    def __init__(self, store: dict[str, dict]):
        self._store = store

    def table(self, name: str):
        return _FakeTable(self._store, name)


@pytest.fixture
def client(monkeypatch):
    # Minimal env vars to allow importing the FastAPI app
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("SUPABASE_URL", "https://fake.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake_key")
    monkeypatch.setenv("OPENAI_API_KEY", "test_key")

    from backend.main import app

    return TestClient(app)


def test_import_batch_async_returns_immediately_with_status_url(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    store: dict[str, dict] = {}
    import_routes.sb = _FakeSB(store)

    async def _fake_scrape_all_sources(_loc: str, **_kwargs):
        return [
            {
                "source": "zoopla",
                "external_id": "1",
                "title": "t",
                "location": _loc,
                "price": 123,
                "url": "https://example.com/1",
            }
        ]

    # Avoid any real DB work in tests.
    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )

    def _fake_update_scrape_run_data(*, run_id, data, status=None, count_inserted=None, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["data"] = data
        if status is not None:
            row["status"] = status
        if count_inserted is not None:
            row["count_inserted"] = count_inserted
        if error is not None:
            row["error"] = error
        store[rid] = row

    def _fake_finish_scrape_run(*, run_id, status, count_inserted, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["status"] = status
        row["count_inserted"] = count_inserted
        row["error"] = error
        store[rid] = row

    monkeypatch.setattr(
        import_routes, "update_scrape_run_data", _fake_update_scrape_run_data, raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", _fake_finish_scrape_run, raising=True)

    resp = client.post(
        "/import/batch",
        json={
            "cities": ["London", "Birmingham"],
            "max_pages": 1,
            "delay_min_s": 0,
            "delay_max_s": 0,
        },
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("queued") is True
    assert isinstance(data.get("batch_id"), str)
    assert isinstance(data.get("status_url"), str)
    assert data["status_url"].startswith("/import/batch/status/")

    status = client.get(data["status_url"], headers={"x-admin-token": "secret"})
    assert status.status_code == 200
    s = status.json()
    assert s["batch_id"] == data["batch_id"]
    assert isinstance(s.get("per_city"), dict)
    assert set(s["per_city"].keys()) == {"London", "Birmingham"}
    for city in ("London", "Birmingham"):
        entry = s["per_city"][city]
        assert isinstance(entry, dict)
        assert isinstance(entry.get("sources"), dict)
        assert set(entry["sources"].keys()) == {"rightmove", "zoopla", "onthemarket"}
        for src in ("rightmove", "zoopla", "onthemarket"):
            assert isinstance(entry["sources"][src], dict)
            assert entry["sources"][src].get("status") in {"queued", "running", "success", "error"}
    assert s.get("status") in {"queued", "running", "success", "partial", "error"}
    assert s.get("durable") is True


def test_import_batch_async_city_error_does_not_crash_job(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    store: dict[str, dict] = {}
    import_routes.sb = _FakeSB(store)

    async def _fake_scrape_all_sources(loc: str, **_kwargs):
        if loc == "BadCity":
            raise RuntimeError("boom")
        return []

    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )

    def _fake_update_scrape_run_data(*, run_id, data, status=None, count_inserted=None, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["data"] = data
        if status is not None:
            row["status"] = status
        if count_inserted is not None:
            row["count_inserted"] = count_inserted
        if error is not None:
            row["error"] = error
        store[rid] = row

    def _fake_finish_scrape_run(*, run_id, status, count_inserted, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["status"] = status
        row["count_inserted"] = count_inserted
        row["error"] = error
        store[rid] = row

    monkeypatch.setattr(
        import_routes, "update_scrape_run_data", _fake_update_scrape_run_data, raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", _fake_finish_scrape_run, raising=True)

    resp = client.post(
        "/import/batch",
        json={
            "cities": ["GoodCity", "BadCity"],
            "max_pages": 1,
            "delay_min_s": 0,
            "delay_max_s": 0,
        },
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    status = client.get(data["status_url"], headers={"x-admin-token": "secret"})
    assert status.status_code == 200
    s = status.json()
    assert set(s["per_city"].keys()) == {"GoodCity", "BadCity"}
    for city in ("GoodCity", "BadCity"):
        entry = s["per_city"][city]
        assert isinstance(entry, dict)
        assert isinstance(entry.get("sources"), dict)
        assert set(entry["sources"].keys()) == {"rightmove", "zoopla", "onthemarket"}
    # One city may still be queued/running, but the status endpoint must be readable.
    assert s.get("status") in {"queued", "running", "success", "partial", "error"}


def test_import_batch_async_persists_and_completes(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    store: dict[str, dict] = {}
    import_routes.sb = _FakeSB(store)

    async def _fake_scrape_all_sources(loc: str, **kwargs):
        on_source_complete = kwargs.get("on_source_complete")
        if callable(on_source_complete):
            await on_source_complete(
                "onthemarket",
                [{"source": "onthemarket", "external_id": "ot-1", "title": "London N22"}],
                "success",
                None,
                {"detail_fetch_attempted": 1, "detail_fetch_succeeded": 1},
            )
        return [
            {
                "source": "onthemarket",
                "external_id": "ot-1",
                "title": f"{loc} N22",
                "location": loc,
                "price": 123,
                "url": "https://www.onthemarket.com/details/1/",
            }
        ]

    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )

    def _fake_update_scrape_run_data(*, run_id, data, status=None, count_inserted=None, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["data"] = data
        if status is not None:
            row["status"] = status
        if count_inserted is not None:
            row["count_inserted"] = count_inserted
        if error is not None:
            row["error"] = error
        store[rid] = row

    def _fake_finish_scrape_run(*, run_id, status, count_inserted, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["status"] = status
        row["count_inserted"] = count_inserted
        row["error"] = error
        store[rid] = row

    monkeypatch.setattr(
        import_routes, "update_scrape_run_data", _fake_update_scrape_run_data, raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", _fake_finish_scrape_run, raising=True)

    resp = client.post(
        "/import/batch",
        json={
            "cities": ["London"],
            "sources": ["onthemarket"],
            "max_pages": 1,
            "delay_min_s": 0,
            "delay_max_s": 0,
            "run_async": True,
            "per_city_timeout_s": 1,
        },
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200
    payload = resp.json()
    batch_id = payload["batch_id"]

    # DB-backed status must recognize the batch id immediately.
    status = client.get(f"/import/batch/status/{batch_id}", headers={"x-admin-token": "secret"})
    assert status.status_code == 200

    # Poll until done.
    for _ in range(50):
        status = client.get(f"/import/batch/status/{batch_id}", headers={"x-admin-token": "secret"})
        assert status.status_code == 200
        s = status.json()
        if s.get("status") in {"success", "partial", "error"}:
            break
    else:
        pytest.fail("batch did not reach terminal status")

    assert s.get("durable") is True
    assert s.get("batch_id") == batch_id


def test_import_batch_async_zero_results_is_not_timeout(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    store: dict[str, dict] = {}
    import_routes.sb = _FakeSB(store)

    async def _fake_scrape_all_sources(_loc: str, **kwargs):
        on_source_complete = kwargs.get("on_source_complete")
        if callable(on_source_complete):
            await on_source_complete(
                "onthemarket", [], "empty", None, {"detail_fetch_attempted": 0}
            )
        return []

    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )

    def _fake_update_scrape_run_data(*, run_id, data, status=None, count_inserted=None, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["data"] = data
        if status is not None:
            row["status"] = status
        if count_inserted is not None:
            row["count_inserted"] = count_inserted
        if error is not None:
            row["error"] = error
        store[rid] = row

    def _fake_finish_scrape_run(*, run_id, status, count_inserted, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["status"] = status
        row["count_inserted"] = count_inserted
        row["error"] = error
        store[rid] = row

    monkeypatch.setattr(
        import_routes, "update_scrape_run_data", _fake_update_scrape_run_data, raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", _fake_finish_scrape_run, raising=True)

    resp = client.post(
        "/import/batch",
        json={
            "cities": ["London"],
            "sources": ["onthemarket"],
            "max_pages": 1,
            "delay_min_s": 0,
            "delay_max_s": 0,
            "run_async": True,
            "per_city_timeout_s": 0.1,
        },
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200
    batch_id = resp.json()["batch_id"]

    for _ in range(50):
        status = client.get(f"/import/batch/status/{batch_id}", headers={"x-admin-token": "secret"})
        assert status.status_code == 200
        s = status.json()
        if s.get("status") in {"success", "partial", "error"}:
            break
    else:
        pytest.fail("batch did not reach terminal status")

    assert s.get("durable") is True
    assert s.get("status") == "success"
    assert s.get("error") not in ("timeout", "no results")


def test_import_batch_accepts_locations_alias_and_sources_filter(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    store: dict[str, dict] = {}
    import_routes.sb = _FakeSB(store)

    async def _fake_scrape_all_sources(_loc: str, **_kwargs):
        return []

    # Avoid any real scraping/DB work in tests.
    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )

    def _fake_update_scrape_run_data(*, run_id, data, status=None, count_inserted=None, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["data"] = data
        if status is not None:
            row["status"] = status
        if count_inserted is not None:
            row["count_inserted"] = count_inserted
        if error is not None:
            row["error"] = error
        store[rid] = row

    def _fake_finish_scrape_run(*, run_id, status, count_inserted, error=None):
        rid = str(run_id)
        row = store.get(rid) or {"id": rid}
        row["status"] = status
        row["count_inserted"] = count_inserted
        row["error"] = error
        store[rid] = row

    monkeypatch.setattr(
        import_routes, "update_scrape_run_data", _fake_update_scrape_run_data, raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", _fake_finish_scrape_run, raising=True)

    resp = client.post(
        "/import/batch",
        json={
            "locations": ["London"],
            "sources": ["onthemarket"],
            "max_pages": 1,
            "delay_min_s": 0,
            "delay_max_s": 0,
        },
        headers={"x-admin-token": "secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    status = client.get(data["status_url"], headers={"x-admin-token": "secret"})
    assert status.status_code == 200
    s = status.json()
    assert s.get("cities") == ["London"]
    assert s.get("sources") == ["onthemarket"]
    assert set(s["per_city"].keys()) == {"London"}
    entry = s["per_city"]["London"]
    assert set(entry["sources"].keys()) == {"onthemarket"}
