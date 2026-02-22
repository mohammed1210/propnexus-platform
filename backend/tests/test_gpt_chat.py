"""
Tests for Sprint 11 GPT chat endpoint.
Mocks OpenAI responses to avoid requiring real API keys in tests.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client to avoid real API calls."""
    with patch("backend.routes.gpt_routes.get_client") as mock_get_client:
        # Create mock client
        mock_client = MagicMock()

        # Mock chat completion response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "This is a mock AI response."
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20

        mock_client.chat.completions.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        yield mock_client


def test_ai_chat_success(mock_openai_client):
    """Test successful AI chat request."""
    from backend.main import app

    client = TestClient(app)

    response = client.post(
        "/gpt/chat",
        json={
            "messages": [{"role": "user", "content": "Tell me about this property"}],
            "context": {"property_id": "123", "summary": "Great deal"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "reply" in data
    assert data["reply"] == "This is a mock AI response."
    assert "usage" in data
    assert data["usage"]["prompt_tokens"] == 10
    assert data["usage"]["completion_tokens"] == 20


def test_ai_chat_missing_messages():
    """Test AI chat request with missing messages."""
    from backend.main import app

    client = TestClient(app)

    response = client.post("/gpt/chat", json={})

    assert response.status_code == 400
    assert "messages" in response.text.lower()


def test_ai_chat_empty_messages():
    """Test AI chat request with empty messages array."""
    from backend.main import app

    client = TestClient(app)

    response = client.post("/gpt/chat", json={"messages": []})

    assert response.status_code == 400


def test_ai_chat_without_context(mock_openai_client):
    """Test AI chat works without context."""
    from backend.main import app

    client = TestClient(app)

    response = client.post(
        "/gpt/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "reply" in data


def test_ai_chat_disabled_when_no_api_key(monkeypatch):
    """When OPENAI_API_KEY is missing, endpoints should return 503 with ai_disabled."""
    from backend.main import app

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    # Ensure module-level cache isn't carrying a client from other tests.
    import backend.routes.gpt_routes as gpt_routes

    gpt_routes._client = None

    client = TestClient(app)
    response = client.post(
        "/gpt/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    assert response.status_code == 503
    payload = response.json()
    assert payload["detail"]["ai_disabled"] is True


def test_gpt_health_reports_ai_enabled(monkeypatch):
    from backend.main import app

    client = TestClient(app)

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    resp = client.get("/gpt/health")
    assert resp.status_code == 200
    assert resp.json()["ai_enabled"] is False

    monkeypatch.setenv("OPENAI_API_KEY", "test")
    resp2 = client.get("/gpt/health")
    assert resp2.status_code == 200
    assert resp2.json()["ai_enabled"] is True
