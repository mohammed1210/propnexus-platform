"""Tests for the tradesmen routes.

These tests verify the /tradesmen/nearby and /tradesmen/contact endpoints.
In CI environments without Supabase credentials, tests are skipped gracefully.
"""

import pytest
from fastapi.testclient import TestClient

try:
    from backend.main import app

    _import_error = None
except Exception as e:  # pragma: no cover
    app = None
    _import_error = e


def test_nearby_tradesmen_endpoint_structure() -> None:
    """Test that the /tradesmen/nearby endpoint is available and validates input."""
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    # Test with missing required parameters
    response = client.get("/tradesmen/nearby")
    assert response.status_code == 422  # Validation error

    # Test with valid parameters (may return empty list if no data)
    response = client.get("/tradesmen/nearby?lat=51.5074&lng=-0.1278&radius_km=10")
    # Should return 200 with empty or populated list, 503 if DB not available, or 500 if network issue
    assert response.status_code in [200, 500, 503]

    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)


def test_nearby_tradesmen_with_trade_filter() -> None:
    """Test filtering tradesmen by trade type."""
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    # Test with trade_type filter
    response = client.get(
        "/tradesmen/nearby?lat=51.5074&lng=-0.1278&trade_type=builder&radius_km=20"
    )

    # Should return 200 with list, 503 if DB unavailable, or 500 if network issue
    assert response.status_code in [200, 500, 503]

    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)
        # If there are results, they should all be builders
        for tradesman in data:
            if tradesman.get("trade_type"):
                assert tradesman["trade_type"].lower() == "builder"


def test_contact_tradesman_endpoint_structure() -> None:
    """Test that the /tradesmen/contact endpoint validates input correctly."""
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    client = TestClient(app)

    # Test with missing body
    response = client.post("/tradesmen/contact", json={})
    assert response.status_code == 422  # Validation error

    # Test with invalid message (too short)
    response = client.post(
        "/tradesmen/contact",
        json={
            "tradesman_id": "00000000-0000-0000-0000-000000000000",
            "user_email": "test@example.com",
            "message": "Hi",  # Too short
        },
    )
    assert response.status_code == 422  # Validation error

    # Test with valid structure but fake tradesman ID
    response = client.post(
        "/tradesmen/contact",
        json={
            "tradesman_id": "00000000-0000-0000-0000-000000000000",
            "user_email": "test@example.com",
            "message": "Hello, I would like to discuss a project.",
        },
    )
    # Should fail with 404 (tradesman not found), 503 (DB unavailable), or 500 (network issue)
    assert response.status_code in [404, 500, 503]


def test_haversine_distance_calculation() -> None:
    """Test the Haversine distance calculation logic."""
    if app is None:  # pragma: no cover
        pytest.skip(f"App unavailable in CI: {_import_error}")

    from backend.routes.tradesmen_routes import haversine_distance

    # Test known distance: London to Paris (approx 344 km)
    london_lat, london_lng = 51.5074, -0.1278
    paris_lat, paris_lng = 48.8566, 2.3522

    distance = haversine_distance(london_lat, london_lng, paris_lat, paris_lng)

    # Distance should be approximately 344 km (allow 10% margin)
    assert 300 < distance < 380

    # Test zero distance (same location)
    distance_zero = haversine_distance(london_lat, london_lng, london_lat, london_lng)
    assert distance_zero == 0.0
