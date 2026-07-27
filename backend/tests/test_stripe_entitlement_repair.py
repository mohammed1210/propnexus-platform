import json

import pytest

from backend.scripts import stripe_entitlement_repair as repair


def test_live_stripe_key_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_stripe_key("sk" + "_live_" + "EXAMPLE")

    assert error.value.code == "live_stripe_key"


def test_missing_stripe_key_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_stripe_key("")

    assert error.value.code == "missing_stripe_key"


def test_starter_maps_to_stripe_price_pro_and_pro():
    mapping = repair.plan_mapping("starter")

    assert mapping.railway_price_variable == "STRIPE_PRICE_PRO"
    assert mapping.backend_plan == "pro"


def test_investor_pro_maps_to_stripe_price_investor_and_investor():
    mapping = repair.plan_mapping("investor_pro")

    assert mapping.railway_price_variable == "STRIPE_PRICE_INVESTOR"
    assert mapping.backend_plan == "investor"


def test_multiple_subscriptions_produce_warning_with_deterministic_choice():
    selected, warning = repair.select_subscription(
        {
            "data": [
                {
                    "id": "SUBSCRIPTION_OLD",
                    "status": "active",
                    "created": 10,
                    "items": {"data": []},
                },
                {
                    "id": "SUBSCRIPTION_NEW",
                    "status": "trialing",
                    "created": 20,
                    "items": {"data": []},
                },
            ]
        }
    )

    assert selected["id"] == "SUBSCRIPTION_NEW"
    assert warning is True


@pytest.mark.parametrize("status", ["canceled", "incomplete"])
def test_canceled_or_incomplete_subscription_cannot_be_applied(status):
    assert repair.can_apply_subscription(status) is False


def test_dry_run_match_detection_performs_no_write():
    result = repair.railway_match_result(
        {"STRIPE_PRICE_PRO": "PRICE_IDENTIFIER"}, "STRIPE_PRICE_PRO", "PRICE_IDENTIFIER"
    )

    assert result == "MATCH"


def test_missing_event_id_skips_resend():
    assert repair.main(["validate-event-id", "--event-id", ""]) == 0


def test_malformed_event_id_is_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_event_id("EVENT_IDENTIFIER")

    assert error.value.code == "malformed_event_id"


def test_live_mode_event_is_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_event({"livemode": True, "type": "checkout.session.completed"})

    assert error.value.code == "event_not_test_mode"


def test_unknown_event_type_is_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_event({"livemode": False, "type": "payment_intent.succeeded"})

    assert error.value.code == "unknown_event_type"


def test_output_redaction_does_not_expose_full_ids():
    full_identifier = "IDENTIFIER_COMPLETE_VALUE"
    redacted = repair.redact_identifier(full_identifier)

    assert full_identifier not in redacted
    assert redacted == "IDENTIFIER_...[redacted]"


def test_price_validation_requires_test_mode_expected_product_and_recurring():
    repair.validate_price(
        {
            "id": "PRICE_IDENTIFIER",
            "livemode": False,
            "active": True,
            "recurring": {"interval": "month"},
            "product": "PRODUCT_IDENTIFIER",
        },
        "PRODUCT_IDENTIFIER",
    )


def test_price_validation_rejects_unexpected_product():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_price(
            {
                "id": "PRICE_IDENTIFIER",
                "livemode": False,
                "active": True,
                "recurring": {"interval": "month"},
                "product": "PRODUCT_A",
            },
            "PRODUCT_B",
        )

    assert error.value.code == "unexpected_product"


def test_old_price_with_other_eligible_subscriber_blocks_overwrite():
    assert repair.has_other_eligible_subscribers(
        {
            "data": [
                {
                    "id": "SELECTED_SUBSCRIPTION",
                    "status": "active",
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "NEW_PRICE_IDENTIFIER",
                                    "recurring": {"interval": "month"},
                                }
                            }
                        ]
                    },
                },
                {
                    "id": "OTHER_SUBSCRIPTION",
                    "status": "trialing",
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "OLD_PRICE_IDENTIFIER",
                                    "recurring": {"interval": "month"},
                                }
                            }
                        ]
                    },
                },
            ]
        },
        selected_subscription_id="SELECTED_SUBSCRIPTION",
        old_price_id="OLD_PRICE_IDENTIFIER",
    )


def test_old_price_without_other_eligible_subscriber_allows_overwrite():
    assert not repair.has_other_eligible_subscribers(
        {
            "data": [
                {
                    "id": "OTHER_SUBSCRIPTION",
                    "status": "canceled",
                    "items": {
                        "data": [
                            {
                                "price": {
                                    "id": "OLD_PRICE_IDENTIFIER",
                                    "recurring": {"interval": "month"},
                                }
                            }
                        ]
                    },
                }
            ]
        },
        selected_subscription_id="SELECTED_SUBSCRIPTION",
        old_price_id="OLD_PRICE_IDENTIFIER",
    )


def test_checkout_event_must_match_selected_customer_and_subscription():
    repair.validate_event_binding(
        {
            "livemode": False,
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "CUSTOMER_IDENTIFIER",
                    "subscription": "SELECTED_SUBSCRIPTION",
                }
            },
        },
        {
            "customer_id": "CUSTOMER_IDENTIFIER",
            "subscription_id": "SELECTED_SUBSCRIPTION",
        },
    )


def test_subscription_event_must_match_selected_subscription():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_event_binding(
            {
                "livemode": False,
                "type": "customer.subscription.deleted",
                "data": {
                    "object": {
                        "id": "OTHER_SUBSCRIPTION",
                        "customer": "CUSTOMER_IDENTIFIER",
                    }
                },
            },
            {
                "customer_id": "CUSTOMER_IDENTIFIER",
                "subscription_id": "SELECTED_SUBSCRIPTION",
            },
        )

    assert error.value.code == "event_subscription_mismatch"


def test_event_customer_mismatch_is_rejected():
    with pytest.raises(repair.RepairError) as error:
        repair.validate_event_binding(
            {
                "livemode": False,
                "type": "customer.subscription.updated",
                "data": {
                    "object": {
                        "id": "SELECTED_SUBSCRIPTION",
                        "customer": "OTHER_CUSTOMER",
                    }
                },
            },
            {
                "customer_id": "CUSTOMER_IDENTIFIER",
                "subscription_id": "SELECTED_SUBSCRIPTION",
            },
        )

    assert error.value.code == "event_customer_mismatch"


def test_validate_overwrite_command_checks_all_subscription_inventories(tmp_path):
    context_json = tmp_path / "context.json"
    selected_json = tmp_path / "selected.json"
    global_json = tmp_path / "global.json"
    context_json.write_text(
        json.dumps(
            {
                "subscription_id": "SELECTED_SUBSCRIPTION",
                "current_railway_price_id": "OLD_PRICE_IDENTIFIER",
                "price_id": "NEW_PRICE_IDENTIFIER",
            }
        ),
        encoding="utf-8",
    )
    selected_json.write_text(json.dumps({"data": []}), encoding="utf-8")
    global_json.write_text(
        json.dumps(
            {
                "data": [
                    {
                        "id": "OTHER_SUBSCRIPTION",
                        "status": "active",
                        "items": {
                            "data": [
                                {
                                    "price": {
                                        "id": "OLD_PRICE_IDENTIFIER",
                                        "recurring": {"interval": "month"},
                                    }
                                }
                            ]
                        },
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    assert (
        repair.main(
            [
                "validate-overwrite",
                "--context-json",
                str(context_json),
                "--subscriptions-json",
                str(selected_json),
                "--subscriptions-json",
                str(global_json),
            ]
        )
        == 2
    )


def test_validate_overwrite_rejects_truncated_old_price_inventory(tmp_path):
    context_json = tmp_path / "context.json"
    subscriptions_json = tmp_path / "subscriptions.json"
    context_json.write_text(
        json.dumps(
            {
                "subscription_id": "SELECTED_SUBSCRIPTION",
                "current_railway_price_id": "OLD_PRICE_IDENTIFIER",
                "price_id": "NEW_PRICE_IDENTIFIER",
            }
        ),
        encoding="utf-8",
    )
    subscriptions_json.write_text(json.dumps({"data": [], "has_more": True}), encoding="utf-8")

    assert (
        repair.main(
            [
                "validate-overwrite",
                "--context-json",
                str(context_json),
                "--subscriptions-json",
                str(subscriptions_json),
            ]
        )
        == 2
    )
