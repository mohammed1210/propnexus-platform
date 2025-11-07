"""
Test /users/plan endpoint with Authorization header support (Sprint 11).
"""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import os


def test_users_plan_with_authorization_header():
    """Test /users/plan endpoint with Authorization: Bearer header."""
    from backend.main import app
    
    client = TestClient(app)
    
    # Mock JWT decode to return email
    with patch("backend.routes.users_routes.jwt.decode") as mock_decode:
        mock_decode.return_value = {"sub": "auth-user@example.com"}
        
        # Mock Supabase
        with patch("backend.routes.users_routes.sb") as mock_sb:
            mock_result = MagicMock()
            mock_result.data = {
                "email": "auth-user@example.com",
                "plan": "pro",
                "stripe_customer_id": "cus_auth_123",
            }
            
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            mock_sb.table.return_value = mock_table
            
            # Request with Authorization header
            response = client.get(
                "/users/plan",
                headers={"Authorization": "Bearer fake_token_123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["plan"] == "pro"
            assert data["stripe_customer_id"] == "cus_auth_123"


def test_users_plan_authorization_takes_precedence():
    """Test that Authorization header takes precedence over email query param."""
    from backend.main import app
    
    client = TestClient(app)
    
    # Mock JWT decode to return email from token
    with patch("backend.routes.users_routes.jwt.decode") as mock_decode:
        mock_decode.return_value = {"sub": "token-user@example.com"}
        
        with patch("backend.routes.users_routes.sb") as mock_sb:
            mock_result = MagicMock()
            mock_result.data = {
                "email": "token-user@example.com",
                "plan": "investor",
                "stripe_customer_id": "cus_token_123",
            }
            
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            mock_sb.table.return_value = mock_table
            
            # Request with both Authorization header and email query param
            response = client.get(
                "/users/plan?email=query-user@example.com",
                headers={"Authorization": "Bearer fake_token_123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            # Should use token email, not query email
            assert data["plan"] == "investor"
            
            # Verify the query used the token email
            mock_table.select.return_value.eq.assert_called_with("email", "token-user@example.com")


def test_users_plan_fallback_to_query_param():
    """Test that email query param works when no Authorization header."""
    from backend.main import app
    
    client = TestClient(app)
    
    with patch("backend.routes.users_routes.sb") as mock_sb:
        mock_result = MagicMock()
        mock_result.data = {
            "email": "query-user@example.com",
            "plan": "free",
            "stripe_customer_id": None,
        }
        
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
        mock_sb.table.return_value = mock_table
        
        # Request with only email query param
        response = client.get("/users/plan?email=query-user@example.com")
        
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] == "free"


def test_users_plan_invalid_token_format():
    """Test handling of invalid token format."""
    from backend.main import app
    
    client = TestClient(app)
    
    with patch("backend.routes.users_routes.sb") as mock_sb:
        mock_result = MagicMock()
        mock_result.data = {
            "email": "query@example.com",
            "plan": "free",
            "stripe_customer_id": None,
        }
        
        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
        mock_sb.table.return_value = mock_table
        
        # Invalid token format (missing "Bearer")
        response = client.get(
            "/users/plan?email=query@example.com",
            headers={"Authorization": "InvalidFormat token123"}
        )
        
        # Should fallback to query param
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] == "free"


def test_users_plan_no_email_source():
    """Test error when neither Authorization nor email query param provided."""
    from backend.main import app
    
    client = TestClient(app)
    
    # Request without Authorization or email query param
    response = client.get("/users/plan")
    
    assert response.status_code == 400
    assert "Missing email" in response.json()["detail"]


def test_users_plan_jwt_decode_failure():
    """Test graceful handling when JWT decode fails."""
    from backend.main import app
    
    client = TestClient(app)
    
    # Mock JWT decode to raise exception
    with patch("backend.routes.users_routes.jwt.decode") as mock_decode:
        from jose import JWTError
        mock_decode.side_effect = JWTError("Invalid token")
        
        with patch("backend.routes.users_routes.sb") as mock_sb:
            mock_result = MagicMock()
            mock_result.data = {
                "email": "fallback@example.com",
                "plan": "free",
                "stripe_customer_id": None,
            }
            
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            mock_sb.table.return_value = mock_table
            
            # Should fallback to query param when token decode fails
            response = client.get(
                "/users/plan?email=fallback@example.com",
                headers={"Authorization": "Bearer invalid_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["plan"] == "free"


def test_users_plan_supabase_jwt():
    """Test extracting email from Supabase JWT token."""
    from backend.main import app
    
    client = TestClient(app)
    
    # Mock JWT decode to return Supabase-style token with email field
    with patch("backend.routes.users_routes.jwt.decode") as mock_decode:
        mock_decode.return_value = {"email": "supabase-user@example.com", "aud": "authenticated"}
        
        with patch("backend.routes.users_routes.sb") as mock_sb:
            mock_result = MagicMock()
            mock_result.data = {
                "email": "supabase-user@example.com",
                "plan": "investor",
                "stripe_customer_id": "cus_supabase_123",
            }
            
            mock_table = MagicMock()
            mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_result
            mock_sb.table.return_value = mock_table
            
            response = client.get(
                "/users/plan",
                headers={"Authorization": "Bearer supabase_token_123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["plan"] == "investor"
