"""
Tests for token-based authentication on /users/plan endpoint.
"""

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def test_plan_endpoint_with_valid_token():
    """Test /users/plan endpoint with valid JWT token in Authorization header."""
    from backend.main import app

    client = TestClient(app)

    # Mock JWT verification to return a valid payload
    with patch("backend.routes.users_routes.verify_supabase_token") as mock_verify:
        mock_verify.return_value = {"email": "token-user@example.com", "sub": "user-id-123"}

        # Mock extract_bearer_token
        with patch("backend.routes.users_routes.extract_bearer_token") as mock_extract:
            mock_extract.return_value = "valid-jwt-token"

            # Mock Supabase client
            mock_sb = MagicMock()
            mock_result = MagicMock()
            mock_result.data = {
                "email": "token-user@example.com",
                "plan": "pro",
                "stripe_customer_id": "cus_token_123",
            }

            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_result
            )
            mock_sb.table.return_value = mock_table

            with patch("backend.routes.users_routes.sb", mock_sb):
                response = client.get(
                    "/users/plan", headers={"Authorization": "Bearer valid-jwt-token"}
                )

                assert response.status_code == 200
                data = response.json()
                assert data["plan"] == "pro"
                assert data["stripe_customer_id"] == "cus_token_123"


def test_plan_endpoint_with_invalid_token():
    """Test /users/plan endpoint with invalid JWT token."""
    from backend.main import app

    client = TestClient(app)

    # Mock JWT verification to return None (invalid token)
    with patch("backend.routes.users_routes.verify_supabase_token") as mock_verify:
        mock_verify.return_value = None

        with patch("backend.routes.users_routes.extract_bearer_token") as mock_extract:
            mock_extract.return_value = "invalid-jwt-token"

            response = client.get(
                "/users/plan", headers={"Authorization": "Bearer invalid-jwt-token"}
            )

            assert response.status_code == 401
            data = response.json()
            assert "Invalid or expired token" in data["detail"]


def test_plan_endpoint_with_malformed_auth_header():
    """Test /users/plan endpoint with malformed Authorization header."""
    from backend.main import app

    client = TestClient(app)

    with patch("backend.routes.users_routes.extract_bearer_token") as mock_extract:
        mock_extract.return_value = None  # Malformed header

        response = client.get("/users/plan", headers={"Authorization": "InvalidFormat token"})

        assert response.status_code == 401
        data = response.json()
        assert "Invalid Authorization header format" in data["detail"]


def test_plan_endpoint_without_auth():
    """Test /users/plan endpoint without any authentication."""
    from backend.main import app

    client = TestClient(app)

    response = client.get("/users/plan")

    assert response.status_code == 401
    data = response.json()
    assert "Missing authentication" in data["detail"]


def test_plan_endpoint_email_param_takes_precedence():
    """Test that email query param takes precedence over Authorization header."""
    from backend.main import app

    client = TestClient(app)

    # Mock Supabase client
    mock_sb = MagicMock()
    mock_result = MagicMock()
    mock_result.data = {
        "email": "email-user@example.com",
        "plan": "investor",
        "stripe_customer_id": "cus_email_456",
    }

    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
        mock_result
    )
    mock_sb.table.return_value = mock_table

    with patch("backend.routes.users_routes.sb", mock_sb):
        # Even with a valid Authorization header, email param should be used
        response = client.get(
            "/users/plan?email=email-user@example.com",
            headers={"Authorization": "Bearer some-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["plan"] == "investor"
        assert data["stripe_customer_id"] == "cus_email_456"

        # Verify that the email parameter was used, not the token
        mock_table.select.return_value.eq.assert_called_with("email", "email-user@example.com")


def test_plan_endpoint_token_with_investor_plan():
    """Test /users/plan endpoint returns investor plan via token auth."""
    from backend.main import app

    client = TestClient(app)

    with patch("backend.routes.users_routes.verify_supabase_token") as mock_verify:
        mock_verify.return_value = {"email": "investor-token@example.com", "sub": "investor-123"}

        with patch("backend.routes.users_routes.extract_bearer_token") as mock_extract:
            mock_extract.return_value = "valid-investor-token"

            mock_sb = MagicMock()
            mock_result = MagicMock()
            mock_result.data = {
                "email": "investor-token@example.com",
                "plan": "investor",
                "stripe_customer_id": "cus_investor_789",
            }

            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
                mock_result
            )
            mock_sb.table.return_value = mock_table

            with patch("backend.routes.users_routes.sb", mock_sb):
                response = client.get(
                    "/users/plan", headers={"Authorization": "Bearer valid-investor-token"}
                )

                assert response.status_code == 200
                data = response.json()
                assert data["plan"] == "investor"
                assert data["stripe_customer_id"] == "cus_investor_789"
