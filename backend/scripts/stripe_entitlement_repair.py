from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ELIGIBLE_STATUSES = {"trialing", "active"}
ALLOWED_EVENT_TYPES = {
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
}
SUBSCRIPTION_EVENT_TYPES = {
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
}


@dataclass(frozen=True)
class PlanMapping:
    railway_price_variable: str
    railway_product_variable: str
    backend_plan: str


PLAN_MAPPINGS = {
    "starter": PlanMapping(
        railway_price_variable="STRIPE_PRICE_PRO",
        railway_product_variable="STRIPE_PRODUCT_PRO",
        backend_plan="pro",
    ),
    "investor_pro": PlanMapping(
        railway_price_variable="STRIPE_PRICE_INVESTOR",
        railway_product_variable="STRIPE_PRODUCT_INVESTOR",
        backend_plan="investor",
    ),
}


class RepairError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def load_json(path: str | Path) -> Any:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str | Path, payload: Any) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def normalize_email(email: str | None) -> str:
    return str(email or "").strip().lower()


def validate_stripe_key(value: str | None) -> None:
    if not value:
        raise RepairError("missing_stripe_key", "STRIPE_TEST_RESTRICTED_KEY is required")
    if value.startswith(("sk_live_", "rk_live_")):
        raise RepairError("live_stripe_key", "Live Stripe keys are not allowed")
    if not value.startswith(("sk_test_", "rk_test_")):
        raise RepairError(
            "invalid_stripe_key", "Stripe key must be a test-mode secret or restricted key"
        )


def plan_mapping(expected_plan: str) -> PlanMapping:
    try:
        return PLAN_MAPPINGS[expected_plan]
    except KeyError as exc:
        raise RepairError("unknown_expected_plan", "Expected plan cannot be mapped") from exc


def data_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        data = payload.get("data", [])
    else:
        data = []
    return [item for item in data if isinstance(item, dict)]


def payload_has_more(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("has_more") is True


def stripe_id(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        object_id = value.get("id")
        return str(object_id) if object_id else None
    return None


def redact_identifier(value: str | None) -> str:
    if not value:
        return "missing"
    if "_" in value:
        prefix = value.split("_", 1)[0]
        return f"{prefix}_...[redacted]"
    return "[redacted]"


def exact_email_customers(customers_payload: Any, email: str) -> list[dict[str, Any]]:
    expected = normalize_email(email)
    return [
        item
        for item in data_items(customers_payload)
        if normalize_email(str(item.get("email", ""))) == expected
    ]


def select_customer(customers_payload: Any, email: str) -> dict[str, Any]:
    matches = exact_email_customers(customers_payload, email)
    if not matches:
        raise RepairError("customer_not_found", "No customer found for the exact email")
    if len(matches) > 1:
        raise RepairError("ambiguous_customer", "Multiple customers matched the exact email")
    customer_id = stripe_id(matches[0])
    if not customer_id:
        raise RepairError("customer_missing_id", "Matched customer has no identifier")
    return matches[0]


def subscription_sort_key(subscription: dict[str, Any]) -> tuple[int, int]:
    status_rank = 0 if subscription.get("status") == "trialing" else 1
    created = int(subscription.get("created") or 0)
    return status_rank, -created


def select_subscription(subscriptions_payload: Any) -> tuple[dict[str, Any], bool]:
    subscriptions = data_items(subscriptions_payload)
    eligible = [item for item in subscriptions if item.get("status") in ELIGIBLE_STATUSES]
    if not eligible:
        raise RepairError("subscription_not_found", "No active or trialing subscription found")

    ordered = sorted(eligible, key=subscription_sort_key)
    selected = ordered[0]
    if len(ordered) > 1:
        first_key = subscription_sort_key(ordered[0])
        second_key = subscription_sort_key(ordered[1])
        if first_key == second_key:
            raise RepairError(
                "ambiguous_subscription",
                "Multiple eligible subscriptions have the same status and created timestamp",
            )

    subscription_id = stripe_id(selected)
    if not subscription_id:
        raise RepairError("subscription_missing_id", "Selected subscription has no identifier")
    return selected, len(eligible) > 1


def subscription_recurring_price_id(subscription: dict[str, Any]) -> str:
    items = data_items(subscription.get("items", {}))
    for item in items:
        price = item.get("price")
        if not isinstance(price, dict):
            continue
        if not price.get("recurring"):
            continue
        price_id = stripe_id(price)
        if price_id:
            return price_id
    raise RepairError("missing_recurring_price", "Selected subscription has no recurring price")


def subscription_uses_price(subscription: dict[str, Any], price_id: str) -> bool:
    if subscription.get("status") not in ELIGIBLE_STATUSES:
        return False
    try:
        return subscription_recurring_price_id(subscription) == price_id
    except RepairError:
        return False


def has_other_eligible_subscribers(
    subscriptions_payload: Any, *, selected_subscription_id: str, old_price_id: str | None
) -> bool:
    if not old_price_id:
        return False
    for subscription in data_items(subscriptions_payload):
        if stripe_id(subscription) == selected_subscription_id:
            continue
        if subscription_uses_price(subscription, old_price_id):
            return True
    return False


def parse_railway_variables(payload: Any) -> dict[str, str]:
    if isinstance(payload, dict):
        if all(isinstance(key, str) for key in payload):
            return {str(key): str(value) for key, value in payload.items() if value is not None}
        variables = payload.get("variables") or payload.get("data") or []
    else:
        variables = payload

    parsed: dict[str, str] = {}
    if isinstance(variables, list):
        for item in variables:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("key")
            value = item.get("value")
            if name and value is not None:
                parsed[str(name)] = str(value)
    return parsed


def railway_match_result(
    variables: dict[str, str], variable_name: str, discovered_value: str
) -> str:
    current = variables.get(variable_name)
    if not current:
        return "MISSING"
    return "MATCH" if current == discovered_value else "MISMATCH"


def validate_price(price: dict[str, Any], expected_product: str | None) -> None:
    if price.get("livemode") is not False:
        raise RepairError("price_not_test_mode", "Selected price is not a test-mode price")
    if price.get("active") is not True:
        raise RepairError("price_inactive", "Selected price is inactive")
    if not price.get("recurring"):
        raise RepairError("price_not_recurring", "Selected price is not recurring")
    if not expected_product:
        raise RepairError(
            "expected_product_missing", "Expected Railway product variable is missing"
        )
    if price.get("product") != expected_product:
        raise RepairError(
            "unexpected_product", "Selected price does not belong to the expected product"
        )


def can_apply_subscription(status: str | None) -> bool:
    return status in ELIGIBLE_STATUSES


def validate_event_id(event_id: str | None) -> None:
    if not event_id:
        raise RepairError("event_id_missing", "No event ID supplied")
    if not re.match(r"^evt_[A-Za-z0-9]+$", event_id):
        raise RepairError("malformed_event_id", "Stripe event ID must begin with the event prefix")


def validate_event(event: dict[str, Any]) -> None:
    if event.get("livemode") is not False:
        raise RepairError("event_not_test_mode", "Live-mode events are not allowed")
    event_type = event.get("type")
    if event_type not in ALLOWED_EVENT_TYPES:
        raise RepairError("unknown_event_type", "Event type is not allowed for this repair")


def event_data_object(event: dict[str, Any]) -> dict[str, Any]:
    data = event.get("data")
    if not isinstance(data, dict):
        return {}
    data_object = data.get("object")
    return data_object if isinstance(data_object, dict) else {}


def event_customer_id(event: dict[str, Any]) -> str | None:
    data_object = event_data_object(event)
    customer = data_object.get("customer")
    if customer_id := stripe_id(customer):
        return customer_id
    customer_details = data_object.get("customer_details")
    if isinstance(customer_details, dict):
        return stripe_id(customer_details.get("customer"))
    return None


def event_subscription_id(event: dict[str, Any]) -> str | None:
    data_object = event_data_object(event)
    event_type = event.get("type")
    if event_type in SUBSCRIPTION_EVENT_TYPES:
        return stripe_id(data_object)
    return stripe_id(data_object.get("subscription"))


def validate_event_binding(event: dict[str, Any], context: dict[str, Any]) -> None:
    validate_event(event)
    expected_customer_id = context.get("customer_id")
    expected_subscription_id = context.get("subscription_id")
    actual_customer_id = event_customer_id(event)
    actual_subscription_id = event_subscription_id(event)
    if not expected_customer_id or actual_customer_id != expected_customer_id:
        raise RepairError("event_customer_mismatch", "Event customer does not match repair context")
    if not expected_subscription_id or actual_subscription_id != expected_subscription_id:
        raise RepairError(
            "event_subscription_mismatch", "Event subscription does not match repair context"
        )


def select_webhook_endpoint(payload: Any, url: str) -> dict[str, Any]:
    matches = [item for item in data_items(payload) if item.get("url") == url]
    if not matches:
        raise RepairError("webhook_endpoint_not_found", "Production webhook endpoint was not found")
    enabled = [item for item in matches if item.get("status") in (None, "enabled")]
    if len(enabled) != 1:
        raise RepairError(
            "ambiguous_webhook_endpoint", "Production webhook endpoint selection is ambiguous"
        )
    endpoint_id = stripe_id(enabled[0])
    if not endpoint_id:
        raise RepairError("webhook_endpoint_missing_id", "Webhook endpoint has no identifier")
    return enabled[0]


def safe_context(
    *,
    email: str,
    expected_plan: str,
    customer: dict[str, Any] | None,
    subscription: dict[str, Any] | None,
    price: dict[str, Any] | None,
    railway_variables: dict[str, str],
    duplicate_subscription_warning: bool,
) -> dict[str, Any]:
    mapping = plan_mapping(expected_plan)
    price_id = stripe_id(price) if price else None
    status = subscription.get("status") if subscription else None
    result = railway_match_result(railway_variables, mapping.railway_price_variable, price_id or "")
    return {
        "customer_found": "yes" if customer else "no",
        "eligible_subscription_found": "yes" if subscription else "no",
        "stripe_status": status or "missing",
        "expected_backend_plan": mapping.backend_plan,
        "mapped_railway_variable": mapping.railway_price_variable,
        "railway_match_result": result,
        "duplicate_subscription_warning": "yes" if duplicate_subscription_warning else "no",
        "required_next_action": (
            "none" if result == "MATCH" else "apply repair with apply_changes=true"
        ),
        "redacted_price": redact_identifier(price_id),
        "normalized_email": normalize_email(email),
    }


def print_github_outputs(values: dict[str, Any]) -> None:
    output_path = os.getenv("GITHUB_OUTPUT")
    lines = [f"{key}={value}" for key, value in values.items()]
    if output_path:
        with Path(output_path).open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    else:
        print("\n".join(lines))


def command_validate_key(_args: argparse.Namespace) -> int:
    validate_stripe_key(os.getenv("STRIPE_TEST_RESTRICTED_KEY"))
    return 0


def command_plan(args: argparse.Namespace) -> int:
    mapping = plan_mapping(args.expected_plan)
    print_github_outputs(
        {
            "railway_price_variable": mapping.railway_price_variable,
            "railway_product_variable": mapping.railway_product_variable,
            "backend_plan": mapping.backend_plan,
        }
    )
    return 0


def command_select_customer(args: argparse.Namespace) -> int:
    customer = select_customer(load_json(args.customers_json), args.email)
    write_json(args.output_json, customer)
    print_github_outputs({"customer_found": "yes"})
    return 0


def command_select_subscription(args: argparse.Namespace) -> int:
    subscription, duplicate_warning = select_subscription(load_json(args.subscriptions_json))
    price_id = subscription_recurring_price_id(subscription)
    write_json(args.output_json, {"subscription": subscription, "price_id": price_id})
    print_github_outputs(
        {
            "eligible_subscription_found": "yes",
            "stripe_status": subscription.get("status", "missing"),
            "duplicate_subscription_warning": "yes" if duplicate_warning else "no",
        }
    )
    return 0


def command_analyze(args: argparse.Namespace) -> int:
    mapping = plan_mapping(args.expected_plan)
    customer = load_json(args.customer_json)
    subscription_payload = load_json(args.subscription_json)
    subscription = subscription_payload["subscription"]
    price = load_json(args.price_json)
    railway_variables = parse_railway_variables(load_json(args.railway_json))
    validate_price(price, railway_variables.get(mapping.railway_product_variable))
    price_id = stripe_id(price)
    if not price_id:
        raise RepairError("price_missing_id", "Selected price has no identifier")
    result = railway_match_result(railway_variables, mapping.railway_price_variable, price_id)
    context = safe_context(
        email=args.email,
        expected_plan=args.expected_plan,
        customer=customer,
        subscription=subscription,
        price=price,
        railway_variables=railway_variables,
        duplicate_subscription_warning=args.duplicate_subscription_warning == "yes",
    )
    context.update(
        {
            "customer_id": stripe_id(customer),
            "subscription_id": stripe_id(subscription),
            "price_id": price_id,
            "railway_product_variable": mapping.railway_product_variable,
            "current_railway_price_id": railway_variables.get(mapping.railway_price_variable),
            "apply_allowed": "yes" if can_apply_subscription(subscription.get("status")) else "no",
        }
    )
    write_json(args.output_json, context)
    print_github_outputs(
        {
            "railway_match_result": result,
            "mapped_railway_variable": mapping.railway_price_variable,
            "backend_plan": mapping.backend_plan,
            "apply_allowed": context["apply_allowed"],
        }
    )
    return 0


def command_validate_event_id(args: argparse.Namespace) -> int:
    if not args.event_id:
        print_github_outputs({"resend_requested": "no"})
        return 0
    validate_event_id(args.event_id)
    print_github_outputs({"resend_requested": "yes"})
    return 0


def command_validate_event(args: argparse.Namespace) -> int:
    event = load_json(args.event_json)
    if args.context_json:
        validate_event_binding(event, load_json(args.context_json))
    else:
        validate_event(event)
    return 0


def command_validate_overwrite(args: argparse.Namespace) -> int:
    context = load_json(args.context_json)
    selected_subscription_id = context.get("subscription_id")
    current_price_id = context.get("current_railway_price_id")
    discovered_price_id = context.get("price_id")
    if not selected_subscription_id:
        raise RepairError("subscription_missing_id", "Selected subscription has no identifier")
    if current_price_id and discovered_price_id and current_price_id == discovered_price_id:
        return 0
    for subscriptions_json in args.subscriptions_json:
        subscriptions_payload = load_json(subscriptions_json)
        if payload_has_more(subscriptions_payload):
            raise RepairError(
                "old_price_subscription_page_truncated",
                "Old-price subscription inventory was truncated; overwrite cannot be proven safe",
            )
        if has_other_eligible_subscribers(
            subscriptions_payload,
            selected_subscription_id=selected_subscription_id,
            old_price_id=current_price_id,
        ):
            raise RepairError(
                "old_price_has_eligible_subscribers",
                "Current Railway price is still used by another active or trialing subscription",
            )
    return 0


def command_select_endpoint(args: argparse.Namespace) -> int:
    endpoint = select_webhook_endpoint(load_json(args.endpoints_json), args.url)
    write_json(args.output_json, endpoint)
    return 0


def command_summary(args: argparse.Namespace) -> int:
    context = load_json(args.context_json)
    lines = [
        "## Stripe entitlement repair summary",
        "",
        f"- customer found: {context.get('customer_found', 'no')}",
        f"- eligible subscription found: {context.get('eligible_subscription_found', 'no')}",
        f"- Stripe status: {context.get('stripe_status', 'missing')}",
        f"- expected backend plan: {context.get('expected_backend_plan', 'missing')}",
        f"- mapped Railway variable name: {context.get('mapped_railway_variable', 'missing')}",
        f"- Railway match result: {context.get('railway_match_result', 'MISSING')}",
        f"- duplicate subscription warning: {context.get('duplicate_subscription_warning', 'no')}",
        f"- required next action: {context.get('required_next_action', 'manual review')}",
    ]
    target = os.getenv("GITHUB_STEP_SUMMARY")
    if target:
        with Path(target).open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    else:
        print("\n".join(lines))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safe Stripe entitlement repair workflow helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("validate-key").set_defaults(func=command_validate_key)

    plan_parser = subparsers.add_parser("plan")
    plan_parser.add_argument("--expected-plan", required=True)
    plan_parser.set_defaults(func=command_plan)

    customer_parser = subparsers.add_parser("select-customer")
    customer_parser.add_argument("--email", required=True)
    customer_parser.add_argument("--customers-json", required=True)
    customer_parser.add_argument("--output-json", required=True)
    customer_parser.set_defaults(func=command_select_customer)

    subscription_parser = subparsers.add_parser("select-subscription")
    subscription_parser.add_argument("--subscriptions-json", required=True)
    subscription_parser.add_argument("--output-json", required=True)
    subscription_parser.set_defaults(func=command_select_subscription)

    analyze_parser = subparsers.add_parser("analyze")
    analyze_parser.add_argument("--email", required=True)
    analyze_parser.add_argument("--expected-plan", required=True)
    analyze_parser.add_argument("--customer-json", required=True)
    analyze_parser.add_argument("--subscription-json", required=True)
    analyze_parser.add_argument("--price-json", required=True)
    analyze_parser.add_argument("--railway-json", required=True)
    analyze_parser.add_argument("--duplicate-subscription-warning", required=True)
    analyze_parser.add_argument("--output-json", required=True)
    analyze_parser.set_defaults(func=command_analyze)

    event_id_parser = subparsers.add_parser("validate-event-id")
    event_id_parser.add_argument("--event-id", default="")
    event_id_parser.set_defaults(func=command_validate_event_id)

    event_parser = subparsers.add_parser("validate-event")
    event_parser.add_argument("--event-json", required=True)
    event_parser.add_argument("--context-json")
    event_parser.set_defaults(func=command_validate_event)

    overwrite_parser = subparsers.add_parser("validate-overwrite")
    overwrite_parser.add_argument("--context-json", required=True)
    overwrite_parser.add_argument("--subscriptions-json", action="append", required=True)
    overwrite_parser.set_defaults(func=command_validate_overwrite)

    endpoint_parser = subparsers.add_parser("select-endpoint")
    endpoint_parser.add_argument("--endpoints-json", required=True)
    endpoint_parser.add_argument("--url", required=True)
    endpoint_parser.add_argument("--output-json", required=True)
    endpoint_parser.set_defaults(func=command_select_endpoint)

    summary_parser = subparsers.add_parser("summary")
    summary_parser.add_argument("--context-json", required=True)
    summary_parser.set_defaults(func=command_summary)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except RepairError as exc:
        print(json.dumps({"ok": False, "error": exc.code, "message": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
