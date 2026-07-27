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
