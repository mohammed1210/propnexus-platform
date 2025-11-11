"""
Sprint 11: Test that webhook handles 'investor' plan correctly.
Tests the price_id -> plan mapping and database upsert.
"""

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


def test_webhook_investor_plan_checkout():
    """Test checkout.session.completed event with investor price_id."""
    from backend.main import app

    client = TestClient(app)

    # Mock Stripe webhook secret
    with patch.dict(
        "os.environ",
        {"STRIPE_WEBHOOK_SECRET": "test_secret", "STRIPE_PRICE_INVESTOR": "price_investor_123"},
    ):
        # Mock Stripe webhook verification
        with patch(
            "backend.routes.stripe_webhook.stripe.Webhook.construct_event"
        ) as mock_construct:
            mock_construct.return_value = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "subscription": "sub_123",
                        "customer": "cus_123",
                        "customer_details": {"email": "investor@example.com"},
                    }
                },
            }

            # Mock Stripe subscription retrieval
            with patch(
                "backend.routes.stripe_webhook.stripe.Subscription.retrieve"
            ) as mock_retrieve:
                mock_retrieve.return_value = {
                    "status": "active",
                    "current_period_end": 1735689600,  # 2025-01-01
                    "items": {"data": [{"price": {"id": "price_investor_123"}}]},
                }

                # Mock Supabase upsert
                mock_sb = MagicMock()
                mock_table = MagicMock()
                mock_sb.table.return_value = mock_table

                with patch("backend.routes.stripe_webhook.supabase", mock_sb):
                    response = client.post(
                        "/stripe/webhook",
                        content=b"{}",
                        headers={"Stripe-Signature": "test_sig"},
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert data["ok"] is True

                    # Verify upsert was called with correct plan
                    mock_table.upsert.assert_called_once()
                    call_args = mock_table.upsert.call_args[0][0]
                    assert call_args["plan"] == "investor"
                    assert call_args["email"] == "investor@example.com"
                    assert call_args["stripe_customer_id"] == "cus_123"
                    assert call_args["plan_status"] == "active"


def test_webhook_pro_plan_checkout():
    """Test checkout.session.completed event with pro price_id."""
    from backend.main import app

    client = TestClient(app)

    with patch.dict(
        "os.environ", {"STRIPE_WEBHOOK_SECRET": "test_secret", "STRIPE_PRICE_PRO": "price_pro_123"}
    ):
        with patch(
            "backend.routes.stripe_webhook.stripe.Webhook.construct_event"
        ) as mock_construct:
            mock_construct.return_value = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "subscription": "sub_456",
                        "customer": "cus_456",
                        "customer_details": {"email": "pro@example.com"},
                    }
                },
            }

            with patch(
                "backend.routes.stripe_webhook.stripe.Subscription.retrieve"
            ) as mock_retrieve:
                mock_retrieve.return_value = {
                    "status": "active",
                    "current_period_end": 1735689600,
                    "items": {"data": [{"price": {"id": "price_pro_123"}}]},
                }

                mock_sb = MagicMock()
                mock_table = MagicMock()
                mock_sb.table.return_value = mock_table

                with patch("backend.routes.stripe_webhook.supabase", mock_sb):
                    response = client.post(
                        "/stripe/webhook",
                        content=b"{}",
                        headers={"Stripe-Signature": "test_sig"},
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert data["ok"] is True

                    call_args = mock_table.upsert.call_args[0][0]
                    assert call_args["plan"] == "pro"


def test_webhook_unknown_price_preserves_existing_plan():
    """Test that unknown price_id does NOT overwrite existing plan."""
    from backend.main import app

    client = TestClient(app)

    with patch.dict("os.environ", {"STRIPE_WEBHOOK_SECRET": "test_secret"}):
        with patch(
            "backend.routes.stripe_webhook.stripe.Webhook.construct_event"
        ) as mock_construct:
            mock_construct.return_value = {
                "type": "checkout.session.completed",
                "data": {
                    "object": {
                        "subscription": "sub_789",
                        "customer": "cus_789",
                        "customer_details": {"email": "unknown@example.com"},
                    }
                },
            }

            with patch(
                "backend.routes.stripe_webhook.stripe.Subscription.retrieve"
            ) as mock_retrieve:
                mock_retrieve.return_value = {
                    "status": "active",
                    "current_period_end": 1735689600,
                    "items": {"data": [{"price": {"id": "price_unknown_xyz"}}]},  # Unknown price_id
                }

                mock_sb = MagicMock()
                mock_table = MagicMock()
                mock_sb.table.return_value = mock_table

                with patch("backend.routes.stripe_webhook.supabase", mock_sb):
                    response = client.post(
                        "/stripe/webhook",
                        content=b"{}",
                        headers={"Stripe-Signature": "test_sig"},
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert data["ok"] is True

                    call_args = mock_table.upsert.call_args[0][0]
                    # Unknown price_id should NOT set plan field (preserves existing plan)
                    assert "plan" not in call_args


def test_users_plan_endpoint_returns_investor():
    """Test /users/plan endpoint returns 'investor' from database."""
    from backend.main import app

    client = TestClient(app)

    with patch("backend.routes.users_routes.sb") as mock_sb:
        # Mock Supabase response with investor plan
        mock_result = MagicMock()
        mock_result.data = {
            "email": "investor@example.com",
            "plan": "investor",
            "stripe_customer_id": "cus_investor_123",
        }

        mock_table = MagicMock()
        mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = (
            mock_result
        )
        mock_sb.table.return_value = mock_table

        response = client.get("/users/plan?email=investor@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data["plan"] == "investor"
        assert data["stripe_customer_id"] == "cus_investor_123"
