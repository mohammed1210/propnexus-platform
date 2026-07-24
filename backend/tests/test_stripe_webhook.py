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
    os.environ["STRIPE_PRICE_PRO"] = "price_test"

    from backend.main import app

    return TestClient(app)


def _mock_supabase_tables(mock_supabase, *, user_update_rows=None, user_update_error=None):
    users_table = Mock()
    subscriptions_table = Mock()
    prices_table = Mock()

    user_execute = users_table.update.return_value.eq.return_value.execute
    if user_update_error:
        user_execute.side_effect = user_update_error
    else:
        user_execute.return_value = Mock(
            data=user_update_rows if user_update_rows is not None else []
        )
    users_table.upsert.return_value.execute.return_value = Mock(data=[])

    subscriptions_table.upsert.return_value.execute.return_value = Mock(data=[])
    prices_table.upsert.return_value.execute.return_value = Mock(data=[])

    def _table(name):
        return {
            "users": users_table,
            "subscriptions": subscriptions_table,
            "prices": prices_table,
        }[name]

    mock_supabase.table.side_effect = _table
    return users_table, subscriptions_table, prices_table


def _post_checkout_completed(client, mock_stripe, *, email_fields=None, price_id="price_pro_test"):
    if email_fields is None:
        email_fields = {"customer_details": {"email": "test@example.com"}}
    mock_event = {
        "id": "evt_checkout_test",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test",
                "subscription": "sub_test",
                **email_fields,
            }
        },
    }
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "trialing",
        "items": {"data": [{"price": {"id": price_id}}]},
        "current_period_end": 1234567890,
    }
    mock_stripe.Price.retrieve.return_value = {
        "id": price_id,
        "product": "prod_test",
        "nickname": "Test price",
        "unit_amount": 900,
        "currency": "gbp",
        "recurring": {"interval": "month"},
    }

    os.environ["STRIPE_PRICE_PRO"] = price_id
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    return client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_sig"},
    )


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


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_updated_event(mock_stripe, mock_supabase, client):
    """Test handling of subscription update event"""
    _mock_supabase_tables(mock_supabase, user_update_rows=[{"id": "existing-user-id"}])
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


@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_secret_per_request(mock_stripe, client):
    """Test that webhook secret is read per-request, not at import time"""
    # Set initial webhook secret
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_initial"

    mock_event = {
        "type": "customer.created",
        "data": {"object": {"id": "cus_test"}},
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event

    # First request with initial secret
    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "sig1"}
    )
    assert response.status_code == 200

    # Change secret without module reload
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_updated"

    # Second request should use updated secret
    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "sig2"}
    )
    assert response.status_code == 200

    # Verify construct_event was called with updated secret on second call
    assert mock_stripe.Webhook.construct_event.call_count == 2
    last_call_secret = mock_stripe.Webhook.construct_event.call_args[1]["secret"]
    assert last_call_secret == "whsec_updated"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_unknown_price_id_preserves_plan(mock_stripe, mock_supabase, client):
    """Unknown checkout price IDs do not grant entitlement and force a retry."""
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
                "subscription": "sub_test",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {"data": [{"price": {"id": "price_unknown_12345"}}]},
        "current_period_end": 1234567890,
    }

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 500
    assert response.json() == {"ok": False, "error": "unknown_price_id"}
    assert not mock_supabase.table.return_value.upsert.called


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_updates_existing_user_by_normalized_email(
    mock_stripe, mock_supabase, client
):
    users_table, _subscriptions_table, _prices_table = _mock_supabase_tables(
        mock_supabase,
        user_update_rows=[{"id": "existing-user-id", "email": "abbas_m90@hotmail.com"}],
    )

    response = _post_checkout_completed(
        client,
        mock_stripe,
        email_fields={"customer_details": {"email": " Abbas_M90@HOTMAIL.COM "}},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    update_payload = users_table.update.call_args.args[0]
    assert update_payload["plan"] == "pro"
    assert update_payload["plan_status"] == "trialing"
    users_table.update.return_value.eq.assert_called_with("email", "abbas_m90@hotmail.com")
    assert not users_table.upsert.called


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_upserts_on_email_conflict_when_no_existing_row(
    mock_stripe, mock_supabase, client
):
    users_table, _subscriptions_table, _prices_table = _mock_supabase_tables(
        mock_supabase,
        user_update_rows=[],
    )

    response = _post_checkout_completed(
        client,
        mock_stripe,
        email_fields={"customer_email": "New_User@Example.COM"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    users_table.upsert.assert_called_once()
    upsert_payload = users_table.upsert.call_args.args[0]
    assert upsert_payload["email"] == "new_user@example.com"
    assert upsert_payload["plan"] == "pro"
    assert users_table.upsert.call_args.kwargs["on_conflict"] == "email"


@pytest.mark.parametrize(
    ("email_fields", "expected_email"),
    [
        ({"customer_email": "customer-email@example.com"}, "customer-email@example.com"),
        ({"metadata": {"email": "metadata-email@example.com"}}, "metadata-email@example.com"),
        ({}, "customer-retrieve@example.com"),
    ],
)
@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_email_fallbacks(
    mock_stripe, mock_supabase, client, email_fields, expected_email
):
    users_table, _subscriptions_table, _prices_table = _mock_supabase_tables(
        mock_supabase,
        user_update_rows=[{"id": "existing-user-id", "email": expected_email}],
    )
    mock_stripe.Customer.retrieve.return_value = {"email": "customer-retrieve@example.com"}

    response = _post_checkout_completed(client, mock_stripe, email_fields=email_fields)

    assert response.status_code == 200
    assert response.json()["ok"] is True
    users_table.update.return_value.eq.assert_called_with("email", expected_email)


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_required_user_write_failure_returns_500(
    mock_stripe, mock_supabase, client
):
    _mock_supabase_tables(mock_supabase, user_update_error=Exception("duplicate email"))

    response = _post_checkout_completed(client, mock_stripe)

    assert response.status_code == 500
    assert response.json() == {"ok": False, "error": "entitlement_write_failed"}


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_deleted_updates_existing_user_without_replacing_id(
    mock_stripe, mock_supabase, client
):
    users_table, _subscriptions_table, _prices_table = _mock_supabase_tables(
        mock_supabase,
        user_update_rows=[{"id": "existing-user-id", "email": "downgrade@example.com"}],
    )
    mock_event = {
        "id": "evt_deleted_test",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_deleted_test",
                "customer": "cus_deleted_test",
                "status": "canceled",
            }
        },
    }
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "downgrade@example.com"}
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "test_sig"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    update_payload = users_table.update.call_args.args[0]
    assert update_payload["plan"] == "free"
    assert update_payload["plan_status"] == "canceled"
    users_table.update.return_value.eq.assert_called_with("email", "downgrade@example.com")
    assert not users_table.upsert.called


@patch("backend.routes.stripe_webhook.stripe")
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
                "subscription": "sub_test",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {"data": [{"price": {"id": "price_test"}}]},
        "current_period_end": 1234567890,
    }

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 500
    assert response.json() == {"ok": False, "error": "entitlement_write_failed"}

    # Restore env vars for other tests
    os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake_key"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_updated_email_retrieval_failure(mock_stripe, mock_supabase, client):
    """Test that subscription.updated handles email retrieval failures gracefully"""
    mock_event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test",
                "customer": "cus_test",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_test"}}]},
                "current_period_end": 1234567890,
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    # Simulate Customer.retrieve failure
    mock_stripe.Customer.retrieve.side_effect = Exception("Customer retrieval failed")

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_created_pro(mock_stripe, mock_supabase, client):
    """Test handling of subscription.created event for Pro tier"""
    # Set Pro price ID
    os.environ["STRIPE_PRICE_PRO"] = "price_pro_test_123"

    mock_event = {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "id": "sub_test",
                "customer": "cus_test_pro",
                "status": "trialing",
                "items": {"data": [{"price": {"id": "price_pro_test_123"}}]},
                "current_period_end": 1234567890,
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "pro@example.com"}

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify upsert was called with Pro plan
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["plan"] == "pro"
    assert upsert_data["plan_status"] == "trialing"
    assert upsert_data["stripe_customer_id"] == "cus_test_pro"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_created_investor(mock_stripe, mock_supabase, client):
    """Test handling of subscription.created event for Investor tier"""
    # Set Investor price ID
    os.environ["STRIPE_PRICE_INVESTOR"] = "price_investor_test_456"

    mock_event = {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "id": "sub_test",
                "customer": "cus_test_investor",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_investor_test_456"}}]},
                "current_period_end": 1234567890,
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "investor@example.com"}

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify upsert was called with Investor plan
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["plan"] == "investor"
    assert upsert_data["plan_status"] == "active"
    assert upsert_data["stripe_customer_id"] == "cus_test_investor"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_subscription_deleted_downgrades_to_free(mock_stripe, mock_supabase, client):
    """Test that subscription.deleted event downgrades user to free plan"""
    mock_event = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_test",
                "customer": "cus_test_delete",
                "status": "canceled",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "downgrade@example.com"}

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify upsert was called with free plan
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["plan"] == "free"
    assert upsert_data["plan_status"] == "canceled"
    assert upsert_data["current_period_end"] is None
    assert upsert_data["stripe_customer_id"] == "cus_test_delete"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_with_pro_price(mock_stripe, mock_supabase, client):
    """Test checkout.session.completed maps Pro price to pro plan"""
    # Set Pro price ID
    os.environ["STRIPE_PRICE_PRO"] = "price_pro_checkout_789"

    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_checkout_pro",
                "customer_details": {"email": "checkout_pro@example.com"},
                "subscription": "sub_checkout_test",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "trialing",
        "items": {"data": [{"price": {"id": "price_pro_checkout_789"}}]},
        "current_period_end": 1234567890,
    }

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify upsert was called with Pro plan
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["plan"] == "pro"
    assert upsert_data["plan_status"] == "trialing"


@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_checkout_completed_with_investor_price(mock_stripe, mock_supabase, client):
    """Test checkout.session.completed maps Investor price to investor plan"""
    # Set Investor price ID
    os.environ["STRIPE_PRICE_INVESTOR"] = "price_investor_checkout_abc"

    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_checkout_investor",
                "customer_details": {"email": "checkout_investor@example.com"},
                "subscription": "sub_checkout_investor_test",
            }
        },
    }

    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.return_value = {
        "status": "active",
        "items": {"data": [{"price": {"id": "price_investor_checkout_abc"}}]},
        "current_period_end": 1234567890,
    }

    # Mock Supabase upsert
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

    response = client.post(
        "/stripe/webhook", data=json.dumps(mock_event), headers={"Stripe-Signature": "test_sig"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    # Verify upsert was called with Investor plan
    assert mock_supabase.table.return_value.upsert.called
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert upsert_data["plan"] == "investor"
    assert upsert_data["plan_status"] == "active"
