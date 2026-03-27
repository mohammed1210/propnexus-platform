import json
import os
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    os.environ["SUPABASE_URL"] = "https://fake.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake_key"

    from backend.main import app

    return TestClient(app)


@patch("backend.routes.stripe_webhook.capture_exception")
@patch("backend.routes.stripe_webhook.capture_message")
@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_success_instrumentation(
    mock_stripe, mock_supabase, mock_capture_message, _mock_capture_exception, client
):
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
        "items": {"data": [{"price": {"id": "price_test_123"}}]},
        "current_period_end": 1234567890,
    }
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = Mock(data=[])

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "sig_test"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    assert any(
        call.args[0] == "stripe_webhook_received" for call in mock_capture_message.call_args_list
    )
    processed_calls = [
        call
        for call in mock_capture_message.call_args_list
        if call.args and call.args[0] == "stripe_webhook_processed"
    ]
    assert processed_calls
    processed_ctx = processed_calls[-1].kwargs.get("stripe_webhook", {})
    assert processed_ctx.get("event_type") == "checkout.session.completed"
    assert processed_ctx.get("customer_id") == "cus_test123"
    assert processed_ctx.get("subscription_id") == "sub_test123"
    assert processed_ctx.get("price_id") == "price_test_123"
    assert processed_ctx.get("db_write_succeeded") is True


@patch("backend.routes.stripe_webhook.capture_exception")
@patch("backend.routes.stripe_webhook.capture_message")
@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_signature_failure_instrumentation(
    mock_stripe, mock_capture_message, _mock_capture_exception, client
):
    class _SigErr(Exception):
        pass

    mock_stripe.error.SignatureVerificationError = _SigErr
    mock_stripe.Webhook.construct_event.side_effect = _SigErr("bad sig")

    response = client.post(
        "/stripe/webhook",
        data=json.dumps({"type": "checkout.session.completed", "data": {"object": {}}}),
        headers={"Stripe-Signature": "sig_bad"},
    )

    assert response.status_code == 400
    assert response.json()["ok"] is False
    assert any(
        call.args[0] == "stripe_webhook_signature_failure"
        for call in mock_capture_message.call_args_list
    )


@patch("backend.routes.stripe_webhook.capture_exception")
@patch("backend.routes.stripe_webhook.capture_message")
@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_invalid_payload_instrumentation(
    mock_stripe, mock_capture_message, _mock_capture_exception, client
):
    class _SigErr(Exception):
        pass

    mock_stripe.error.SignatureVerificationError = _SigErr
    mock_stripe.Webhook.construct_event.side_effect = ValueError("invalid payload")

    response = client.post(
        "/stripe/webhook",
        data="not-json",
        headers={"Stripe-Signature": "sig_test"},
    )

    assert response.status_code == 400
    assert response.json()["ok"] is False
    assert any(
        call.args[0] == "stripe_webhook_invalid_payload"
        for call in mock_capture_message.call_args_list
    )


@patch("backend.routes.stripe_webhook.capture_exception")
@patch("backend.routes.stripe_webhook.capture_message")
@patch("backend.routes.stripe_webhook.supabase")
@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_partial_db_write_soft_failure_instrumentation(
    mock_stripe, mock_supabase, mock_capture_message, _mock_capture_exception, client
):
    mock_event = {
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "id": "sub_soft_1",
                "customer": "cus_soft_1",
                "status": "active",
                "items": {"data": [{"price": {"id": "price_soft_1"}}]},
                "current_period_end": 1234567890,
            }
        },
    }
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Customer.retrieve.return_value = {"email": "soft@example.com"}

    mock_supabase.table.return_value.upsert.return_value.execute.side_effect = Exception("db down")

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "sig_test"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    partial_calls = [
        call
        for call in mock_capture_message.call_args_list
        if call.args and call.args[0] == "stripe_webhook_partial_db_write"
    ]
    assert partial_calls
    partial_ctx = partial_calls[-1].kwargs.get("stripe_webhook", {})
    assert partial_ctx.get("event_type") == "customer.subscription.created"
    assert partial_ctx.get("customer_id") == "cus_soft_1"
    assert partial_ctx.get("db_write_succeeded") is False


@patch("backend.routes.stripe_webhook.capture_exception")
@patch("backend.routes.stripe_webhook.capture_message")
@patch("backend.routes.stripe_webhook.stripe")
def test_webhook_unexpected_exception_instrumentation(
    mock_stripe, mock_capture_message, mock_capture_exception, client
):
    mock_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_boom",
                "customer_details": {"email": "boom@example.com"},
                "subscription": "sub_boom",
            }
        },
    }
    mock_stripe.Webhook.construct_event.return_value = mock_event
    mock_stripe.Subscription.retrieve.side_effect = Exception("unexpected boom")

    response = client.post(
        "/stripe/webhook",
        data=json.dumps(mock_event),
        headers={"Stripe-Signature": "sig_test"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is False

    assert mock_capture_exception.called
    assert any(
        call.args[0] == "stripe_webhook_unexpected_exception"
        for call in mock_capture_message.call_args_list
    )
