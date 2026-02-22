from fastapi.testclient import TestClient


def test_ai_summary_disabled_when_no_api_key(monkeypatch):
    from backend.main import app

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    client = TestClient(app)
    response = client.post(
        "/ai/summary",
        json={"title": "Test property", "location": "London"},
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["detail"]["ai_disabled"] is True
