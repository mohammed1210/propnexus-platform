"""
Tests for Sprint 11 AI scoring endpoints.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def test_ai_score_basic():
    """Test basic scoring endpoint with minimal data."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 5.5,
            "roi_percent": 8.0,
            "rent": 1200,
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "score" in data
    assert 0 <= data["score"] <= 100
    assert "categories" in data
    assert "yield" in data["categories"]
    assert "roi" in data["categories"]
    assert "version" in data
    assert data["version"] == "v1.0"


def test_ai_score_empty_data():
    """Test scoring with empty/missing data."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post("/gpt/score", json={})
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "score" in data
    # Should handle gracefully with defaults
    assert 0 <= data["score"] <= 100


def test_ai_score_full_data():
    """Test scoring with complete property data."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 300000,
            "yield_percent": 6.2,
            "roi_percent": 10.5,
            "rent": 1500,
            "crime_index": 35,
            "schools_rating": 4.2,
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["score"] > 0
    
    # Check all categories are present
    categories = data["categories"]
    assert "yield" in categories
    assert "roi" in categories
    assert "price_to_rent" in categories
    assert "area_demand" in categories
    assert "crime_index_inverse" in categories
    assert "schools_access" in categories


def test_ai_score_categories_sum():
    """Test that category scores are within expected ranges."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 7.0,
            "roi_percent": 12.0,
            "rent": 1400,
            "crime_index": 25,
            "schools_rating": 4.5,
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Each category should be within its max range
    categories = data["categories"]
    assert 0 <= categories["yield"] <= 20
    assert 0 <= categories["roi"] <= 20
    assert 0 <= categories["price_to_rent"] <= 15
    assert 0 <= categories["area_demand"] <= 15
    assert 0 <= categories["crime_index_inverse"] <= 15
    assert 0 <= categories["schools_access"] <= 15


@pytest.fixture
def mock_openai_client_explain():
    """Mock OpenAI client for explanation endpoint."""
    with patch("backend.routes.gpt_routes.get_client") as mock_get_client:
        mock_client = MagicMock()
        
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = """SUMMARY: This is a solid investment with good fundamentals.

BULLETS:
- Strong rental yield indicates good cash flow
- Area has low crime rates
- Good school access nearby
- Property priced competitively
- ROI projections are positive"""
        
        mock_client.chat.completions.create.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        yield mock_client


def test_ai_score_explain_success(mock_openai_client_explain):
    """Test score explanation endpoint."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score/explain",
        json={
            "score": 75,
            "property": {
                "price": 250000,
                "location": "Manchester",
                "bedrooms": 2,
                "yield_percent": 6.0,
                "roi_percent": 10.0,
            },
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "explanation" in data
    assert "bullets" in data
    assert isinstance(data["bullets"], list)
    assert len(data["bullets"]) > 0


def test_ai_score_explain_minimal(mock_openai_client_explain):
    """Test explanation with minimal data."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score/explain",
        json={"score": 50, "property": {}},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "explanation" in data
    assert "bullets" in data
