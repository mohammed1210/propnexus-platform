from fastapi.testclient import TestClient


def test_ai_health_exists(app):
    client = TestClient(app)
    r = client.get("/ai/health")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "ai_enabled" in data
    assert "ai_disabled" in data
