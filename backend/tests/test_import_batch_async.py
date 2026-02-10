import pytest
from fastapi.testclient import TestClient


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
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

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
    monkeypatch.setattr(
        import_routes, "create_scrape_run", lambda **_kw: "batch-test-1", raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", lambda **_kw: None, raising=True)

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
    assert data.get("batch_id") == "batch-test-1"
    assert isinstance(data.get("status_url"), str)
    assert data["status_url"].startswith("/import/batch/status/")

    status = client.get(data["status_url"], headers={"x-admin-token": "secret"})
    assert status.status_code == 200
    s = status.json()
    assert s["batch_id"] == "batch-test-1"
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


def test_import_batch_async_city_error_does_not_crash_job(client, monkeypatch):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    async def _fake_scrape_all_sources(loc: str, **_kwargs):
        if loc == "BadCity":
            raise RuntimeError("boom")
        return []

    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )
    monkeypatch.setattr(
        import_routes, "create_scrape_run", lambda **_kw: "batch-test-2", raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", lambda **_kw: None, raising=True)

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

    def test_import_batch_async_completes_with_results(monkeypatch, client):
        from backend.utils import ingest as ingest_mod

        async def _fake_scrape_all_sources(*args, **kwargs):
            on_source_complete = kwargs.get("on_source_complete")
            assert callable(on_source_complete)
            # Mimic a single source finishing successfully.
            await on_source_complete(
                "london",
                "onthemarket",
                2,
                None,
                {"detail_fetch_succeeded": 2, "detail_fetch_attempted": 2},
            )

        monkeypatch.setattr(ingest_mod, "scrape_all_sources", _fake_scrape_all_sources)

        resp = client.post(
            "/import/batch",
            json={
                "cities": ["london"],
                "sources": ["onthemarket"],
                "max_pages": 1,
                "run_async": True,
                "per_city_timeout_s": 1,
            },
            headers={"x-admin-token": "test"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["queued"] is True
        batch_id = body["batch_id"]

        # Poll until completion (background task runs on event loop).
        for _ in range(50):
            status = client.get(
                f"/import/batch/status/{batch_id}", headers={"x-admin-token": "test"}
            )
            assert status.status_code == 200
            payload = status.json()
            if payload["status"] in ("completed", "partial_success", "failed"):
                break
        else:
            pytest.fail("Async batch did not finish in time")

        assert payload["status"] in ("completed", "partial_success")
        assert payload["total_scraped"] == 2
        assert payload["error"] in (None, "")

    def test_import_batch_async_zero_results_is_not_timeout(monkeypatch, client):
        from backend.utils import ingest as ingest_mod

        async def _fake_scrape_all_sources(*args, **kwargs):
            on_source_complete = kwargs.get("on_source_complete")
            assert callable(on_source_complete)
            # Source completes successfully but finds no results.
            await on_source_complete(
                "london", "onthemarket", 0, None, {"detail_fetch_attempted": 0}
            )

        monkeypatch.setattr(ingest_mod, "scrape_all_sources", _fake_scrape_all_sources)

        resp = client.post(
            "/import/batch",
            json={
                "cities": ["london"],
                "sources": ["onthemarket"],
                "max_pages": 1,
                "run_async": True,
                "per_city_timeout_s": 1,
            },
            headers={"x-admin-token": "test"},
        )
        assert resp.status_code == 200
        batch_id = resp.json()["batch_id"]

        for _ in range(50):
            status = client.get(
                f"/import/batch/status/{batch_id}", headers={"x-admin-token": "test"}
            )
            assert status.status_code == 200
            payload = status.json()
            if payload["status"] in ("completed", "partial_success", "failed"):
                break
        else:
            pytest.fail("Async batch did not finish in time")

        # Zero results should still be a completion, not a timeout.
        assert payload["status"] == "completed"
        assert payload["total_scraped"] == 0
        assert payload.get("error") not in ("timeout", "no results")


def test_import_batch_accepts_locations_alias_and_sources_filter(client, monkeypatch):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    import backend.routes.import_routes as import_routes

    async def _fake_scrape_all_sources(_loc: str, **_kwargs):
        return []

    # Avoid any real scraping/DB work in tests.
    monkeypatch.setattr(import_routes, "scrape_all_sources", _fake_scrape_all_sources, raising=True)
    monkeypatch.setattr(
        import_routes, "_upsert_properties_rows", lambda **_kw: (True, None), raising=True
    )
    monkeypatch.setattr(
        import_routes, "create_scrape_run", lambda **_kw: "batch-test-3", raising=True
    )
    monkeypatch.setattr(import_routes, "finish_scrape_run", lambda **_kw: None, raising=True)

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
