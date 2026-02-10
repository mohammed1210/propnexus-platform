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
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties")

    # Should not be 404 (endpoint exists)
    assert response.status_code != 404
    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"

    data = response.json()
    assert isinstance(data, dict)
    assert "mappable_count" in data
    assert isinstance(data.get("mappable_count"), int)


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_with_filters(mock_create_client, client):
    """Test properties list with various filters"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.or_.return_value = mock_query
    mock_query.eq.return_value = mock_query
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
    mock_query.execute.return_value = Mock(data=mock_properties, count=1)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get(
        "/properties",
        params={
            "q": "London",
            "source": "zoopla",
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
    assert isinstance(data, dict)
    assert isinstance(data.get("items"), list)
    assert isinstance(data.get("total"), int)
    assert isinstance(data.get("mappable_count"), int)
    assert len(data.get("items") or []) == 1

    # Verify filters were applied
    mock_query.eq.assert_called_once()  # source filter
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
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties")

    assert response.status_code == 200
    assert response.headers.get("X-PropNexus-Properties-Normalization") == "v1"

    # Should order by created_at by default
    assert mock_query.order.call_count >= 1
    first_call = mock_query.order.call_args_list[0]
    assert first_call[0][0] == "created_at"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_invalid_sort(mock_create_client, client):
    """Test properties list with invalid sort column falls back to default"""
    # Mock Supabase client
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"sort": "invalid_column"})

    assert response.status_code == 200

    # Should fall back to created_at
    first_call = mock_query.order.call_args_list[0]
    assert first_call[0][0] == "created_at"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_recommended_sort_orders_by_score_then_created_at(
    mock_create_client, client
):
    """Recommended sort should order by score desc (NULLS LAST) then created_at desc."""

    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"sort": "recommended"})
    assert response.status_code == 200

    assert mock_query.order.call_count >= 2
    first = mock_query.order.call_args_list[0]
    second = mock_query.order.call_args_list[1]
    assert first[0][0] == "score"
    assert second[0][0] == "created_at"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_price_desc_returns_items_with_null_or_invalid_price(
    mock_create_client, client
):
    """Regression: price_desc should not yield empty items when rows have null/invalid price values."""

    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    # Intentionally unsorted input (we're not relying on the Supabase mock to sort).
    mock_properties = [
        {
            "id": "p1",
            "title": "Null price",
            "location": "London",
            "price": None,
            "latitude": 51.5,
            "longitude": -0.12,
        },
        {
            "id": "p3",
            "title": "Numeric price",
            "location": "London",
            "price": 500000,
            "latitude": 52.0,
            "longitude": 0.1,
        },
        {
            "id": "p2",
            "title": "String price",
            "location": "London",
            "price": "£250,000",
            "latitude": None,
            "longitude": None,
        },
    ]

    mock_query.execute.return_value = Mock(data=mock_properties, count=3)
    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"sort": "price_desc"})

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert isinstance(data.get("items"), list)
    assert len(data.get("items") or []) == 3
    assert isinstance(data.get("mappable_count"), int)
    # Two items have valid in-range coordinates.
    assert data.get("mappable_count") == 2

    items = data.get("items")
    assert items[0]["id"] == "p3"  # 500k first
    assert items[1]["id"] == "p2"  # "£250,000" coerced
    assert items[2]["id"] == "p1"  # null last


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
