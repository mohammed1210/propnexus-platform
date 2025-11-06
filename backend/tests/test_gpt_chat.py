"""
Tests for Sprint 11 GPT chat endpoint.
Mocks OpenAI responses to avoid requiring real API keys in tests.
"""
import os
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
