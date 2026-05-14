from backend.schemas.ai import StrategiesRequest
from backend.services.ai_service import format_strategies_prompt


def _system_prompt(payload: dict) -> str:
    messages = format_strategies_prompt(StrategiesRequest(property=payload))
    return messages[0]["content"]


def test_flip_auction_strategy_prompt_is_not_btl_only():
    prompt = _system_prompt(
        {
            "title": "Auction terrace",
            "investmentType": "Flip / Auction",
            "description": "Guide price auction with modernisation required.",
        }
    )

    assert "UK buy-to-let properties" not in prompt
    assert "Auction route" in prompt
    assert "legal pack" in prompt
    assert "do not force buy-to-let" in prompt


def test_btl_strategy_prompt_keeps_income_guidance():
    prompt = _system_prompt(
        {
            "title": "Income flat",
            "investment_type": "BTL",
            "yield_percent": 7.2,
        }
    )

    assert "BTL/income route" in prompt
    assert "rent evidence" in prompt
    assert "lender stress" in prompt


def test_unknown_strategy_prompt_uses_neutral_language():
    prompt = _system_prompt({"title": "Mixed signal listing", "propertyType": "Terrace"})

    assert "Unknown or mixed route" in prompt
    assert "neutral investment-route language" in prompt
    assert "do not force buy-to-let" in prompt
