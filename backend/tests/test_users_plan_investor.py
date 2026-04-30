"""
Sprint 11: Test that webhook handles 'investor' plan correctly.
Tests the price_id -> plan mapping and database upsert.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


def test_map_price_to_plan_supports_investor_product(monkeypatch):
    """Unknown price IDs can still map when Stripe price belongs to the Investor product."""
    from backend.routes import stripe_webhook

    monkeypatch.delenv("STRIPE_PRICE_INVESTOR", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_STRIPE_PRICE_INVESTOR", raising=False)
    monkeypatch.setenv("STRIPE_PRODUCT_INVESTOR", "prod_TGprLukyGJfRBH")
    monkeypatch.setattr(
        stripe_webhook.stripe.Price,
        "retrieve",
        lambda price_id: {"id": price_id, "product": "prod_TGprLukyGJfRBH"},
    )

    assert stripe_webhook.map_price_to_plan("price_investor_19") == "investor"


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

                    # Webhook performs two upserts:
                    # 1) User record (conflict on email)
                    # 2) Plan fields (plan/period end)
                    assert mock_table.upsert.call_count == 2

                    first_call = mock_table.upsert.call_args_list[0]
                    first_payload = first_call.args[0]
                    assert first_call.kwargs.get("on_conflict") == "email"
                    assert first_payload["email"] == "investor@example.com"
                    assert first_payload["stripe_customer_id"] == "cus_123"
                    assert first_payload["subscription_id"] == "sub_123"
                    assert first_payload["status"] == "active"
                    assert first_payload["price_id"] == "price_investor_123"

                    second_call = mock_table.upsert.call_args_list[1]
                    second_payload = second_call.args[0]
                    assert "on_conflict" not in second_call.kwargs
                    assert second_payload["plan"] == "investor"
                    assert second_payload["plan_status"] == "active"
                    assert second_payload["current_period_end"] == 1735689600
                    assert second_payload["email"] == "investor@example.com"


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
