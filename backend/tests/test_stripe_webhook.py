"""
Tests for Stripe webhook handling
"""

import json
import os
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client"""
    # Set minimal env vars to allow import
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
    os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake_key"

    from backend.main import app

    return TestClient(app)


def test_webhook_endpoint_exists(client):
    """Test that the webhook endpoint is registered"""
    # Without proper signature, should return 400
    response = client.post("/stripe/webhook", json={})
    # Should not be 404 (endpoint exists)
    assert response.status_code != 404


def test_webhook_requires_stripe_config(client):
    """Test that webhook fails gracefully without Stripe config"""
    # Temporarily remove the env var
    old_key = os.environ.get("STRIPE_SECRET_KEY")
    if old_key:
        del os.environ["STRIPE_SECRET_KEY"]

    # Reimport to pick up missing env var
    import importlib
    from backend.routes import stripe_webhook

    importlib.reload(stripe_webhook)

    # Should indicate missing configuration
    response = client.post("/stripe/webhook", json={})

    # Restore env var
    if old_key:
        os.environ["STRIPE_SECRET_KEY"] = old_key

    # Expect error due to missing config
    assert response.status_code in [400, 500]


@patch("backend.routes.stripe_webhook.stripe")
@patch("backend.routes.stripe_webhook.supabase")
def test_checkout_completed_event(mock_supabase, mock_stripe, client):
    """Test handling of checkout.session.completed event"""
    # Mock the Stripe webhook verification
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test123",
                "customer_details": {"email": "test@example.com"},
                "subscription": "sub_test123",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {"data": [{"price": {"id": "price_test"}}]},
    }

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    # Set webhook secret
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_signature"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True


@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_updated_event(mock_stripe, client):
    """Test handling of subscription update event"""
    mock_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test123",
                "customer": "cus_test123",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_test"}}]},
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "test@example.com"}

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_signature"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
