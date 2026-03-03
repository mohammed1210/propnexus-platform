from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from backend.main import app

    return TestClient(app)


def _make_query_mock() -> Mock:
    q = Mock()
    q.select.return_value = q
    q.range.return_value = q
    q.order.return_value = q
    q.or_.return_value = q
    q.eq.return_value = q
    q.gte.return_value = q
    q.lte.return_value = q
    q.in_.return_value = q
    q.ilike.return_value = q
    return q


@patch("backend.routes.properties_routes.create_client")
def test_fuzzy_fallback_preserves_ranking_and_pagination(mock_create_client, client):
    from backend.routes import properties_routes

    mock_sb = Mock()
    mock_query = _make_query_mock()

    # First execute = no direct matches, second execute = filtered fuzzy rows (unsorted order).
    mock_query.execute.side_effect = [
        Mock(data=[], count=0),
        Mock(
            data=[
                {"id": "id2", "title": "B"},
                {"id": "id1", "title": "A"},
                {"id": "id3", "title": "C"},
            ],
            count=3,
        ),
    ]

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    with (
        patch.object(properties_routes.settings, "SMART_SEARCH_SYNONYMS", True),
        patch("backend.routes.properties_routes.is_postgres_detected", return_value=True),
        patch(
            "backend.routes.properties_routes.fetch_postgres_fuzzy_ids",
            return_value=["id1", "id2", "id3"],
        ) as fuzzy_mock,
    ):
        res = client.get("/properties", params={"q": "gaerage", "limit": 1, "offset": 1})

    fuzzy_mock.assert_called_once()
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == "id2"


@patch("backend.routes.properties_routes.create_client")
def test_fuzzy_fallback_reapplies_base_filters(mock_create_client, client):
    from backend.routes import properties_routes

    mock_sb = Mock()
    mock_query = _make_query_mock()
    mock_query.execute.side_effect = [
        Mock(data=[], count=0),
        Mock(data=[{"id": "id1", "title": "A", "price": 200000}], count=1),
    ]

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    with (
        patch.object(properties_routes.settings, "SMART_SEARCH_SYNONYMS", True),
        patch("backend.routes.properties_routes.is_postgres_detected", return_value=True),
        patch("backend.routes.properties_routes.fetch_postgres_fuzzy_ids", return_value=["id1"]),
    ):
        res = client.get(
            "/properties",
            params={
                "q": "gaerage",
                "source": "zoopla",
                "min": 100000,
                "max": 300000,
                "beds": 2,
                "baths": 1,
                "types": "BTL,HMO",
            },
        )

    assert res.status_code == 200

    assert any(c.args == ("source", "zoopla") for c in mock_query.eq.call_args_list)
    assert any(c.args == ("price", 100000) for c in mock_query.gte.call_args_list)
    assert any(c.args == ("price", 300000) for c in mock_query.lte.call_args_list)
    assert any(c.args == ("bedrooms", 2) for c in mock_query.gte.call_args_list)
    assert any(c.args == ("bathrooms", 1) for c in mock_query.gte.call_args_list)
    assert any(c.args and c.args[0] == "id" for c in mock_query.in_.call_args_list)


@patch("backend.routes.properties_routes.create_client")
def test_fuzzy_fallback_skips_when_total_is_nonzero(mock_create_client, client):
    from backend.routes import properties_routes

    mock_sb = Mock()
    mock_query = _make_query_mock()
    mock_query.execute.return_value = Mock(data=[], count=5)

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    with (
        patch.object(properties_routes.settings, "SMART_SEARCH_SYNONYMS", True),
        patch("backend.routes.properties_routes.is_postgres_detected", return_value=True),
        patch("backend.routes.properties_routes.fetch_postgres_fuzzy_ids") as fuzzy_mock,
    ):
        res = client.get("/properties", params={"q": "gaerage", "limit": 10, "offset": 20})

    assert res.status_code == 200
    body = res.json()
    assert body["items"] == []
    assert body["total"] == 5
    fuzzy_mock.assert_not_called()


@patch("backend.routes.properties_routes.create_client")
def test_fuzzy_fallback_without_postgres_uses_python_scoring(mock_create_client, client):
    from backend.routes import properties_routes

    mock_sb = Mock()
    mock_query = _make_query_mock()
    mock_query.execute.side_effect = [
        Mock(data=[], count=0),
        Mock(
            data=[
                {
                    "id": "id1",
                    "title": "Flat",
                    "location": "London",
                    "postcode": "E1 6AN",
                },
                {
                    "id": "id2",
                    "title": "House",
                    "location": "Birmingham",
                    "postcode": "B1 1AA",
                },
            ],
            count=2,
        ),
        Mock(data=[{"id": "id1", "title": "Flat", "location": "London"}], count=1),
    ]

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    with (
        patch.object(properties_routes.settings, "SMART_SEARCH_SYNONYMS", True),
        patch("backend.routes.properties_routes.is_postgres_detected", return_value=False),
        patch("backend.routes.properties_routes.fetch_postgres_fuzzy_ids") as fuzzy_mock,
    ):
        res = client.get("/properties", params={"q": "londn", "limit": 10, "offset": 0})

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == "id1"
    fuzzy_mock.assert_not_called()


@patch("backend.routes.properties_routes.create_client")
def test_fuzzy_fallback_exposes_correction_metadata_when_inferred(mock_create_client, client):
    from backend.routes import properties_routes

    mock_sb = Mock()
    mock_query = _make_query_mock()
    mock_query.execute.side_effect = [
        Mock(data=[], count=0),
        Mock(
            data=[
                {
                    "id": "id1",
                    "title": "Flat",
                    "location": "London",
                    "postcode": "E1 6AN",
                }
            ],
            count=1,
        ),
        Mock(data=[{"id": "id1", "title": "Flat", "location": "London"}], count=1),
    ]

    mock_sb.table.return_value = mock_query
    mock_create_client.return_value = mock_sb

    with (
        patch.object(properties_routes.settings, "SMART_SEARCH_SYNONYMS", True),
        patch("backend.routes.properties_routes.is_postgres_detected", return_value=False),
        patch("backend.routes.properties_routes.fetch_postgres_fuzzy_ids") as fuzzy_mock,
    ):
        res = client.get("/properties", params={"q": "londn", "limit": 10, "offset": 0})

    assert res.status_code == 200
    body = res.json()
    assert body["correction_applied"] is True
    assert body["original_query"] == "londn"
    assert body["corrected_query"] == "london"
    assert body["correction_source"] == "fuzzy_fallback"
    fuzzy_mock.assert_not_called()
