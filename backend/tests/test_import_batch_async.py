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
    # One city may still be queued/running, but the status endpoint must be readable.
    assert s.get("status") in {"queued", "running", "success", "partial", "error"}
