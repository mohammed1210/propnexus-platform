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


def _patch_import_scrapers(monkeypatch):
    """Patch all scraper entrypoints used by import routes to avoid network calls."""

    async def _fake_scrape(_loc: str):
        return []

    import backend.scraper.onthemarket_scraper as otm
    import backend.scraper.rightmove_scraper as rm
    import backend.scraper.spare_room_scraper as spareroom
    import backend.scraper.zoopla_scraper as zoopla
    import backend.utils.ingest as ingest

    monkeypatch.setattr(rm, "scrape_rightmove_properties", _fake_scrape, raising=True)
    monkeypatch.setattr(zoopla, "scrape_zoopla_properties", _fake_scrape, raising=True)
    monkeypatch.setattr(otm, "scrape_onthemarket_properties", _fake_scrape, raising=True)
    monkeypatch.setattr(spareroom, "scrape_spareroom_properties", _fake_scrape, raising=True)
    monkeypatch.setattr(ingest, "scrape_all_sources", _fake_scrape, raising=True)


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("post", "/import/rightmove", {"location": "London"}),
        ("post", "/import/zoopla", {"location": "London"}),
        ("post", "/import/onthemarket", {"location": "London"}),
        ("post", "/import/spareroom", {"location": "London"}),
        ("post", "/import/all?req=London", None),
    ],
)
def test_import_endpoints_require_admin_token_when_configured(
    client, monkeypatch, method: str, path: str, payload
):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")
    _patch_import_scrapers(monkeypatch)

    request = getattr(client, method)

    # Should be rejected without token.
    if payload is None:
        resp = request(path)
    else:
        resp = request(path, json=payload)
    assert resp.status_code == 401

    # Should succeed with correct token.
    headers = {"x-admin-token": "secret"}
    if payload is None:
        resp = request(path, headers=headers)
    else:
        resp = request(path, json=payload, headers=headers)
    assert resp.status_code == 200


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("post", "/import/rightmove", {"location": "London"}),
        ("post", "/import/zoopla", {"location": "London"}),
        ("post", "/import/onthemarket", {"location": "London"}),
        ("post", "/import/spareroom", {"location": "London"}),
        ("post", "/import/all?req=London", None),
    ],
)
def test_import_endpoints_work_without_admin_token_configured(
    client, monkeypatch, method: str, path: str, payload
):
    monkeypatch.delenv("IMPORT_ADMIN_TOKEN", raising=False)
    _patch_import_scrapers(monkeypatch)

    request = getattr(client, method)
    if payload is None:
        resp = request(path)
    else:
        resp = request(path, json=payload)
    assert resp.status_code == 200


def test_debug_scrape_probe_requires_admin_token_when_configured(client, monkeypatch):
    """Sanity check: debug scrape probe stays protected when IMPORT_ADMIN_TOKEN is set."""

    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")
    resp = client.get("/debug/scrape-probe?location=London")
    assert resp.status_code == 401
