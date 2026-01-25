"""
Tests for properties routes
"""

import os
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client"""
    # Set minimal env vars to allow import
    os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake_key"

    from backend.main import app

    return TestClient(app)


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_endpoint_exists(mock_create_client, client):
    """Test that the properties list endpoint is registered"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[])

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties")

    # Should not be 404 (endpoint exists)
    assert response.status_code != 404
    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_with_filters(mock_create_client, client):
    """Test properties list with various filters"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.or_.return_value = mock_query
    mock_query.gte.return_value = mock_query
    mock_query.lte.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.order.return_value = mock_query

    # Mock response data
    mock_properties = [
        {
            "id": "123",
            "title": "Test Property",
            "location": "London",
            "price": 250000,
            "bedrooms": 3,
            "bathrooms": 2,
            "investment_type": "BTL",
            "latitude": 51.5074,
            "longitude": -0.1278,
        }
    ]
    mock_query.execute.return_value = Mock(data=mock_properties)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get(
        "/properties",
        params={
            "q": "London",
            "min": 200000,
            "max": 300000,
            "beds": 2,
            "baths": 1,
            "types": "BTL,HMO",
            "sort": "price",
            "dir": "asc",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"
    data = response.json()
    assert isinstance(data, list)

    # Verify filters were applied
    mock_query.or_.assert_called_once()
    assert mock_query.gte.call_count >= 2  # price and bedrooms filters
    mock_query.lte.assert_called_once()  # max price filter
    mock_query.in_.assert_called_once()  # types filter


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_default_sort(mock_create_client, client):
    """Test properties list uses default sort when not specified"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[])

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties")

    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"

    # Should order by created_at by default
    mock_query.order.assert_called_once()
    call_args = mock_query.order.call_args
    assert call_args[0][0] == "created_at"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_invalid_sort(mock_create_client, client):
    """Test properties list with invalid sort column falls back to default"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[])

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"sort": "invalid_column"})

    assert response.status_code == 200

    # Should fall back to created_at
    call_args = mock_query.order.call_args
    assert call_args[0][0] == "created_at"


@patch("backend.routes.properties_routes.create_client")
def test_get_property_by_id(mock_create_client, client):
    """Test getting a single property by ID"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.maybe_single.return_value = mock_query

    # Mock property data
    mock_property = {
        "id": "123",
        "title": "Test Property",
        "location": "London",
        "price": 250000,
    }
    mock_query.execute.return_value = Mock(data=mock_property)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties/123")

    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"
    data = response.json()
    assert data["id"] == "123"
    assert data["title"] == "Test Property"


@patch("backend.routes.properties_routes.create_client")
def test_get_property_not_found(mock_create_client, client):
    """Test getting a non-existent property"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.maybe_single.return_value = mock_query
    mock_query.execute.return_value = Mock(data=None)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties/nonexistent")

    assert response.status_code == 404
