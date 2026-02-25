from fastapi.testclient import TestClient


def test_gpt_health_contract(app):
    client = TestClient(app)
    r = client.get("/gpt/health")
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data


def test_gpt_chat_missing_key_is_503(app, monkeypatch):
    # Ensure key absent
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    client = TestClient(app)
    r = client.post("/gpt/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code in (401, 403, 503), r.text
