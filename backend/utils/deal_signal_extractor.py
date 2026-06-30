from __future__ import annotations

from typing import Any, Dict

from backend.utils.deal_signals import extract_deal_signals as _extract_deal_signals


def extract_deal_signals(property_data: Dict[str, Any]) -> Dict[str, Any]:
    return _extract_deal_signals(property_data)
