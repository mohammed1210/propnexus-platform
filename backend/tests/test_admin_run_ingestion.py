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


def test_admin_run_ingestion_requires_bearer_when_configured(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    resp = client.post("/admin/run-ingestion", json={"location": "London"})
    assert resp.status_code == 401

    resp = client.post(
        "/admin/run-ingestion",
        json={"location": "London"},
        headers={"Authorization": "Bearer secret"},
    )
    assert resp.status_code == 202


def test_admin_run_ingestion_accepts_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("IMPORT_ADMIN_TOKEN", raising=False)

    resp = client.post("/admin/run-ingestion", json={"location": "London"})
    assert resp.status_code == 401
