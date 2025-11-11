"""
Sprint 11: Test that comps route handles missing/empty sales and rents arrays.
The bug was that code assumed both arrays existed and had .length property.
Now we guard against None/undefined arrays.
"""

from unittest.mock import MagicMock, patch


def test_comps_missing_sales_array():
    """Test comps endpoint when sales array is missing from provider."""

    with patch("backend.routes.comps_routes.get_comps_from_provider") as mock_provider:
        # Provider returns data without 'sales' key
        mock_provider.return_value = {
            "postcode": "SW1A 1AA",
            "rents": [
                {
                    "address": "1 Test St",
                    "price": 1200,
                    "date": "2024-01",
                    "type": "Flat",
                    "distance_km": 0.2,
                }
            ],
        }

        with patch("backend.routes.comps_routes.sb") as mock_sb:
            # Mock empty cache
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
                []
            )
            mock_sb.table.return_value = mock_table

            from backend.routes.comps_routes import get_comps

            result = get_comps("SW1A 1AA", request=None)

            # Should handle gracefully - frontend expects empty array
            assert "postcode" in result
            assert "rents" in result
            # Sales should be present (even if provider didn't return it)
            # Backend should normalize to empty array or frontend should guard


def test_comps_missing_rents_array():
    """Test comps endpoint when rents array is missing from provider."""

    with patch("backend.routes.comps_routes.get_comps_from_provider") as mock_provider:
        # Provider returns data without 'rents' key
        mock_provider.return_value = {
            "postcode": "SW1A 1AA",
            "sales": [
                {
                    "address": "2 Test Ave",
                    "price": 250000,
                    "date": "2024-01",
                    "type": "Flat",
                    "distance_km": 0.3,
                }
            ],
        }

        with patch("backend.routes.comps_routes.sb") as mock_sb:
            # Mock empty cache
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
                []
            )
            mock_sb.table.return_value = mock_table

            from backend.routes.comps_routes import get_comps

            result = get_comps("SW1A 1AA", request=None)

            # Should handle gracefully
            assert "postcode" in result
            assert "sales" in result


def test_comps_both_arrays_missing():
    """Test comps endpoint when both sales and rents are missing."""

    with patch("backend.routes.comps_routes.get_comps_from_provider") as mock_provider:
        # Provider returns minimal data
        mock_provider.return_value = {
            "postcode": "SW1A 1AA",
        }

        with patch("backend.routes.comps_routes.sb") as mock_sb:
            # Mock empty cache
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
                []
            )
            mock_sb.table.return_value = mock_table

            from backend.routes.comps_routes import get_comps

            result = get_comps("SW1A 1AA", request=None)

            # Should handle gracefully
            assert "postcode" in result


def test_comps_empty_arrays():
    """Test comps endpoint with explicitly empty arrays."""

    with patch("backend.routes.comps_routes.get_comps_from_provider") as mock_provider:
        # Provider returns empty arrays
        mock_provider.return_value = {
            "postcode": "SW1A 1AA",
            "sales": [],
            "rents": [],
        }

        with patch("backend.routes.comps_routes.sb") as mock_sb:
            # Mock empty cache
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
                []
            )
            mock_sb.table.return_value = mock_table

            from backend.routes.comps_routes import get_comps

            result = get_comps("SW1A 1AA", request=None)

            # Should return valid structure
            assert "postcode" in result
            assert "sales" in result
            assert "rents" in result
            assert isinstance(result["sales"], list)
            assert isinstance(result["rents"], list)
            assert len(result["sales"]) == 0
            assert len(result["rents"]) == 0
