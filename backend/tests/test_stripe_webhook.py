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


@patch('backend.routes.stripe_webhook.stripe')
@patch('backend.routes.stripe_webhook.supabase')
def test_checkout_completed_event(mock_supabase, mock_stripe, client):
    """Test handling of checkout.session.completed event"""
    # Mock the Stripe webhook verification
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test123",
                "customer_details": {"email": "test@example.com"},
                "subscription": "sub_test123"
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {
            "data": [{"price": {"id": "price_test"}}]
        }
    }
    
    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])
    
    # Set webhook secret
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_signature"}
    )
    
    assert response.status_code == 200
    assert response.json()["ok"] is True


@patch('backend.routes.stripe_webhook.stripe')
def test_subscription_updated_event(mock_stripe, client):
    """Test handling of subscription update event"""
    mock_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test123",
                "customer": "cus_test123",
                "status": "active",
                "items": {
                    "data": [{"price": {"id": "price_test"}}]
                }
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "test@example.com"}
    
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_signature"}
    )
    
    assert response.status_code == 200
    assert response.json()["ok"] is True


@patch('backend.routes.stripe_webhook.stripe')
def test_webhook_secret_per_request(mock_stripe, client):
    """Test that webhook secret is read per-request, not at import time"""
    # Set initial webhook secret
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_initial"
    
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test",
                "customer_details": {"email": "test@example.com"},
                "subscription": None
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    
    # First request with initial secret
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "sig1"}
    )
    assert response.status_code == 200
    
    # Change secret without module reload
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_updated"
    
    # Second request should use updated secret
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "sig2"}
    )
    assert response.status_code == 200
    
    # Verify construct_event was called with updated secret on second call
    assert mock_stripe.Webhook.construct_event.call_count == 2
    last_call_secret = mock_stripe.Webhook.construct_event.call_args[1]['secret']
    assert last_call_secret == "whsec_updated"


@patch('backend.routes.stripe_webhook.supabase')
@patch('backend.routes.stripe_webhook.stripe')
def test_unknown_price_id_preserves_plan(mock_stripe, mock_supabase, client):
    """Test that unknown price IDs do NOT overwrite existing plan to 'free'"""
    # Ensure no price mapping env vars are set
    for key in ["STRIPE_PRICE_PRO", "STRIPE_PRICE_INVESTOR", "STRIPE_PRICE_ENTERPRISE"]:
        if key in os.environ:
            del os.environ[key]
    
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test",
                "customer_details": {"email": "test@example.com"},
                "subscription": "sub_test"
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {
            "data": [{"price": {"id": "price_unknown_12345"}}]
        },
        "current_period_end": 1234567890
    }
    
    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])
    
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_sig"}
    )
    
    assert response.status_code == 200
    assert response.json()["ok"] is True
    
    # Verify upsert was called
    assert mock_supabase.table.return_value.upsert.called
    
    # Get the upsert data
    upsert_call = mock_supabase.table.return_value.upsert.call_args[0][0]
    
    # Verify that 'plan' field is NOT in the upsert data (preserving existing plan)
    assert "plan" not in upsert_call, "Unknown price ID should not set plan field"
    # But other fields should be present
    assert "stripe_customer_id" in upsert_call
    assert "plan_status" in upsert_call


@patch('backend.routes.stripe_webhook.stripe')
def test_graceful_handling_no_supabase(mock_stripe, client):
    """Test graceful handling when Supabase credentials are missing"""
    # Remove Supabase env vars
    for key in ["SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]:
        if key in os.environ:
            del os.environ[key]
    
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test",
                "customer_details": {"email": "test@example.com"},
                "subscription": None
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_sig"}
    )
    
    # Should succeed gracefully without Supabase
    assert response.status_code == 200
    assert response.json()["ok"] is True
    
    # Restore env vars for other tests
    os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake_key"


@patch('backend.routes.stripe_webhook.supabase')
@patch('backend.routes.stripe_webhook.stripe')
def test_subscription_updated_email_retrieval_failure(mock_stripe, mock_supabase, client):
    """Test that subscription.updated handles email retrieval failures gracefully"""
    mock_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test",
                "customer": "cus_test",
                "status": "active",
                "items": {
                    "data": [{"price": {"id": "price_test"}}]
                },
                "current_period_end": 1234567890
            }
        }
    }
    
    mock_stripe.Webhook.construct_event.return_value = mock_event
    # Simulate Customer.retrieve failure
    mock_stripe.Customer.retrieve.side_effect = Exception("Customer retrieval failed")
    
    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])
    
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    
    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_sig"}
    )
    
    # Should succeed despite email retrieval failure
    assert response.status_code == 200
    assert response.json()["ok"] is True
    
    # Verify upsert was still called (with email=None)
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["email"] is None
