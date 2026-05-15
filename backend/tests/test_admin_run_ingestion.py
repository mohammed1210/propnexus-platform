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


def test_admin_ingestion_status_returns_useful_shape(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    resp = client.get("/admin/ingestion/status", headers={"Authorization": "Bearer secret"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["status"] in {"healthy", "degraded", "stale"}
    assert "runner" in data
    assert "latest_scrape_runs" in data


def test_admin_launch_health_returns_json_shape(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret")
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    resp = client.get("/admin/launch-health", headers={"Authorization": "Bearer secret"})

    assert resp.status_code == 200
    data = resp.json()
    assert "operational" in data
    assert "data" in data
    assert "security" in data
    assert "top_deal_version" in data["operational"]
