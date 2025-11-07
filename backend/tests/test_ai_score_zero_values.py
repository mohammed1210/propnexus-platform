"""
Sprint 11: Test that 0-value defaults are handled correctly in scoring.
The bug was that `crime_index=0` was treated as falsy and replaced with 50.
Now we explicitly check for None to preserve 0 values.
"""
from fastapi.testclient import TestClient


def test_ai_score_zero_crime_index():
    """Test that crime_index=0 is preserved (not replaced with 50)."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 5.0,
            "roi_percent": 8.0,
            "rent": 1200,
            "crime_index": 0,  # Explicitly 0 (very safe area)
            "schools_rating": 4.0,
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    
    # With crime_index=0 (safest), crime_index_inverse should be maximum (15 points)
    # Formula: ((100 - crime) / 100.0) * 15 = ((100 - 0) / 100.0) * 15 = 15.0
    assert data["categories"]["crime_index_inverse"] == 15.0


def test_ai_score_zero_schools_rating():
    """Test that schools_rating=0 is preserved (not replaced with 3.0)."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 5.0,
            "roi_percent": 8.0,
            "rent": 1200,
            "crime_index": 50,
            "schools_rating": 0,  # Explicitly 0 (no schools nearby)
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    
    # With schools_rating=0 (worst), schools_access should be 0 points
    # Formula: (schools / 5.0) * 15 = (0 / 5.0) * 15 = 0.0
    assert data["categories"]["schools_access"] == 0.0


def test_ai_score_none_uses_defaults():
    """Test that missing values (None) use defaults (50 for crime, 3.0 for schools)."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 5.0,
            "roi_percent": 8.0,
            "rent": 1200,
            # crime_index and schools_rating are missing (None)
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    
    # With crime_index=50 (default mid-range):
    # crime_index_inverse = ((100 - 50) / 100.0) * 15 = 7.5
    assert data["categories"]["crime_index_inverse"] == 7.5
    
    # With schools_rating=3.0 (default mid-range):
    # schools_access = (3.0 / 5.0) * 15 = 9.0
    assert data["categories"]["schools_access"] == 9.0


def test_ai_score_both_zero_and_none():
    """Test mixed scenario: one field is 0, another is None."""
    from backend.main import app
    
    client = TestClient(app)
    
    response = client.post(
        "/gpt/score",
        json={
            "price": 250000,
            "yield_percent": 5.0,
            "roi_percent": 8.0,
            "rent": 1200,
            "crime_index": 0,  # Explicitly 0
            # schools_rating is missing (None, should use default 3.0)
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    
    # crime_index=0 → 15.0 points
    assert data["categories"]["crime_index_inverse"] == 15.0
    
    # schools_rating=None → default 3.0 → 9.0 points
    assert data["categories"]["schools_access"] == 9.0
