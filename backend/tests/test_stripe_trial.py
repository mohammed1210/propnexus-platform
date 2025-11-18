"""
Tests for Stripe 7-day trial functionality
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


@patch("backend.routes.stripe_routes.stripe")
@patch("backend.routes.stripe_routes.sb")
def test_checkout_session_includes_trial(mock_sb, mock_stripe, client):
    """Test that checkout session includes 7-day trial period"""
    # Mock customer lookup/creation
    mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = Mock(
        data=None
    )
    mock_sb.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])
    
    # Mock Stripe customer search (no existing customer)
    mock_stripe.Customer.search.return_value = Mock(data=[])
    
    # Mock Stripe customer creation
    mock_stripe.Customer.create.return_value = Mock(id="cus_test123")
    
    # Mock checkout session creation
    mock_session = Mock(url="https://checkout.stripe.com/test")
    mock_stripe.checkout.Session.create.return_value = mock_session

    # Make request to create checkout session
    response = client.post(
        "/stripe/create-checkout-session",
        json={"email": "test@example.com", "price_id": "price_test123"},
    )

    assert response.status_code == 200
    assert response.json()["url"] == "https://checkout.stripe.com/test"

    # Verify that checkout.Session.create was called with trial_period_days=7
    assert mock_stripe.checkout.Session.create.called
    call_kwargs = mock_stripe.checkout.Session.create.call_args[1]
    
    assert "subscription_data" in call_kwargs
    assert call_kwargs["subscription_data"]["trial_period_days"] == 7
    assert call_kwargs["mode"] == "subscription"


@patch("backend.routes.stripe_webhook.stripe")
@patch("backend.routes.stripe_webhook.supabase")
def test_webhook_handles_trialing_status(mock_supabase, mock_stripe, client):
    """Test that webhook correctly handles subscriptions with trialing status"""
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
    
    # Mock subscription with trialing status
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "trialing",
        "items": {"data": [{"price": {"id": "price_test"}}]},
        "current_period_end": 1234567890,
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

    # Verify that Supabase was called to store the subscription
    assert mock_supabase.table.return_value.upsert.called
    
    # Get the upsert data
    upsert_call = mock_supabase.table.return_value.upsert.call_args[0][0]
    
    # Verify plan_status is set to 'trialing' (not just 'active')
    assert upsert_call["plan_status"] == "trialing"


@patch("backend.routes.stripe_webhook.stripe")
@patch("backend.routes.stripe_webhook.supabase")
def test_webhook_handles_trial_ending(mock_supabase, mock_stripe, client):
    """Test that webhook handles subscription.updated when trial ends"""
    mock_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test123",
                "customer": "cus_test123",
                "status": "active",  # Changed from trialing to active
                "items": {"data": [{"price": {"id": "price_test"}}]},
                "current_period_end": 1234567890,
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "test@example.com"}

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_signature"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify that Supabase was updated with active status
    assert mock_supabase.table.return_value.upsert.called
    upsert_call = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_call["plan_status"] == "active"
