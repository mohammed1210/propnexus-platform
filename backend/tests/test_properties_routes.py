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
    # Source filter should be applied (other .eq calls may occur, e.g. enrichment cache lookup)
    assert any(
        (c.args[0] == "source" and c.args[1] == "zoopla")
        for c in mock_query.eq.call_args_list
        if getattr(c, "args", None)
    )
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
def test_list_properties_recommended_includes_deal_reasons(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    mock_properties = [
        {
            "id": "p1",
            "title": "Price reduced deal",
            "location": "London",
            "price": 250000,
            "description": "Was £200,000 now £180,000",
            "score": 80,
            "created_at": "2025-01-02T00:00:00Z",
            "score_breakdown": {
                "version": "test",
                "score": 80,
                "categories": {
                    "yield": 18.0,
                    "roi": 16.0,
                    "price_to_rent": 12.0,
                    "area_demand": 10.0,
                    "crime_index_inverse": 10.0,
                    "schools_access": 10.0,
                },
                "inputs": {"rent_source": "provided"},
            },
        }
    ]
    mock_query.execute.return_value = Mock(data=mock_properties, count=1)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"sort": "recommended"})
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    assert isinstance(data.get("items"), list)
    assert len(data["items"]) == 1

    item = data["items"][0]
    assert "recommended_score" in item
    assert "deal_reasons" in item
    assert isinstance(item["deal_reasons"], list)
    assert "deal_signals" in item
    assert isinstance(item["deal_signals"], list)
    assert "discount_estimate_pct" in item


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_deal_filter_auction_only(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    mock_properties = [
        {
            "id": "p1",
            "title": "Auction listing",
            "location": "London",
            "price": 250000,
            "deal_signals": ["auction"],
            "created_at": "2025-01-02T00:00:00Z",
        },
        {
            "id": "p2",
            "title": "Normal listing",
            "location": "London",
            "price": 260000,
            "deal_signals": [],
            "created_at": "2025-01-03T00:00:00Z",
        },
    ]
    mock_query.execute.return_value = Mock(data=mock_properties, count=2)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"auction_only": "1"})
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    items = data.get("items") or []
    assert len(items) == 1
    assert items[0]["id"] == "p1"


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_deal_filter_cash_buyers_only(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    mock_properties = [
        {
            "id": "p1",
            "title": "Unmortgageable project",
            "location": "London",
            "price": 250000,
            "description": "Cash buyers only - no mortgage available.",
            "created_at": "2025-01-02T00:00:00Z",
        },
        {
            "id": "p2",
            "title": "Normal listing",
            "location": "London",
            "price": 260000,
            "description": "A nice home.",
            "created_at": "2025-01-03T00:00:00Z",
        },
    ]
    mock_query.execute.return_value = Mock(data=mock_properties, count=2)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"cash_buyers_only": "true"})
    assert response.status_code == 200

    data = response.json()
    items = data.get("items") or []
    assert len(items) == 1
    assert items[0]["id"] == "p1"
    assert "cash_buyers_only" in (items[0].get("deal_signals") or [])


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_deal_filter_short_lease_only(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    mock_properties = [
        {
            "id": "p1",
            "title": "Leasehold flat",
            "location": "London",
            "price": 250000,
            "description": "Lease 83 years remaining.",
            "created_at": "2025-01-02T00:00:00Z",
        },
        {
            "id": "p2",
            "title": "Long lease",
            "location": "London",
            "price": 260000,
            "description": "Lease 125 years remaining.",
            "created_at": "2025-01-03T00:00:00Z",
        },
    ]
    mock_query.execute.return_value = Mock(data=mock_properties, count=2)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"short_lease_only": "true"})
    assert response.status_code == 200

    data = response.json()
    items = data.get("items") or []
    assert len(items) == 1
    assert items[0]["id"] == "p1"
    assert "short_lease" in (items[0].get("deal_signals") or [])
    # lease_years_remaining is persisted into `data` when present
    if isinstance(items[0].get("data"), dict):
        assert items[0]["data"].get("lease_years_remaining") == 83


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_investment_type_hmo_filters_python_side(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    fake_rows = [
        {
            "id": "p1",
            "title": "Licensed HMO investment",
            "description": "Great HMO near uni",
            "property_type": "Terraced",
            "bedrooms": 6,
        },
        {
            "id": "p2",
            "title": "Normal flat",
            "description": "Nice flat",
            "property_type": "Flat/Apartment",
            "bedrooms": 2,
        },
    ]
    mock_query.execute.return_value = Mock(data=fake_rows, count=len(fake_rows))

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get(
        "/properties", params={"investment_type": "HMO", "limit": 50, "offset": 0}
    )
    assert response.status_code == 200
    data = response.json()
    items = data.get("items") or []
    assert len(items) == 1
    assert "investment_types" in items[0]
    assert "HMO" in (items[0].get("investment_types") or [])
    assert data.get("total") == 1


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_investment_type_brr_filters_python_side(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    fake_rows = [
        {
            "id": "p1",
            "title": "Renovation project - reduced",
            "description": "Needs refurbishment",
            "property_type": "Terraced",
            "deal_signals": ["needs_refurb", "reduced"],
            "discount_estimate_pct": 12.0,
            "bedrooms": 3,
        },
        {
            "id": "p2",
            "title": "Clean BTL",
            "description": "Ready to let",
            "property_type": "Flat/Apartment",
            "bedrooms": 2,
        },
    ]
    mock_query.execute.return_value = Mock(data=fake_rows, count=len(fake_rows))

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get(
        "/properties", params={"investment_type": "BRR", "limit": 50, "offset": 0}
    )
    assert response.status_code == 200
    data = response.json()
    items = data.get("items") or []
    assert len(items) == 1
    assert "BRR" in (items[0].get("investment_types") or [])
    assert data.get("total") == 1


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_property_type_single_uses_in(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"property_type": "Terraced"})
    assert response.status_code == 200
    mock_query.in_.assert_called_once_with("property_type", ["Terraced"])


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_property_type_csv_normalizes_and_uses_in(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.execute.return_value = Mock(data=[], count=0)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties", params={"property_type": "flat,terraced"})
    assert response.status_code == 200
    mock_query.in_.assert_called_once_with("property_type", ["Flat/Apartment", "Terraced"])


@patch("backend.routes.properties_routes.create_client")
def test_list_properties_includes_property_type_when_missing(mock_create_client, client):
    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query

    mock_query.execute.return_value = Mock(
        data=[{"id": "p1", "title": "3 bed terraced house", "location": "London"}],
        count=1,
    )

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    response = client.get("/properties")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert len(data.get("items") or []) == 1
    assert data["items"][0].get("property_type") == "Terraced"


@patch("backend.routes.properties_routes.create_client")
def test_admin_backfill_property_types_requires_token_when_configured(
    mock_create_client, client, monkeypatch
):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")
    mock_create_client.return_value = Mock()

    res = client.post("/properties/admin/backfill-property-types")
    assert res.status_code == 401


@patch("backend.routes.properties_routes.create_client")
def test_admin_backfill_property_types_updates_missing(mock_create_client, client, monkeypatch):
    monkeypatch.setenv("IMPORT_ADMIN_TOKEN", "secret")

    mock_sb = Mock()
    mock_query = Mock()
    mock_query.select.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.update.return_value = mock_query
    mock_query.eq.return_value = mock_query

    # First execute => select rows, second execute => update
    mock_query.execute.side_effect = [
        Mock(
            data=[
                {
                    "id": "p1",
                    "title": "Commercial unit",
                    "description": "Retail unit",
                    "data": {},
                }
            ]
        ),
        Mock(data={}),
    ]

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    res = client.post(
        "/properties/admin/backfill-property-types?limit=1&offset=0",
        headers={"x-admin-token": "secret"},
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload.get("processed_count") == 1
    assert payload.get("updated_count") == 1

    # Ensure we attempted an update including canonical type.
    called_payload = mock_query.update.call_args[0][0]
    assert called_payload.get("property_type") == "Commercial"
    assert isinstance(called_payload.get("data"), dict)
    assert called_payload["data"].get("property_type") == "Commercial"


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
