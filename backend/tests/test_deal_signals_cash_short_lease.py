from backend.utils.deal_signals import extract_deal_signals


def test_extract_cash_buyers_only_phrases():
    rows = [
        {"title": "Fixer upper", "description": "Cash buyers only. No mortgage."},
        {"title": "Unmortgageable property", "description": "Not suitable for mortgage"},
        {"title": "Project", "description": "Mortgage finance not available"},
    ]

    for row in rows:
        extracted = extract_deal_signals(row)
        assert "cash_buyers_only" in (extracted.get("signals") or [])


def test_extract_cash_buyers_only_does_not_trigger_on_weak_cash_mentions():
    row = {
        "title": "Nice flat",
        "description": "Cashback available and mortgage advisers on hand.",
    }
    extracted = extract_deal_signals(row)
    assert "cash_buyers_only" not in (extracted.get("signals") or [])


def test_extract_short_lease_by_years_threshold_85():
    extracted_short = extract_deal_signals({"description": "Lease 83 years remaining"})
    assert "short_lease" in (extracted_short.get("signals") or [])
    assert extracted_short.get("lease_years_remaining") == 83

    extracted_ok = extract_deal_signals({"description": "Lease 86 years remaining"})
    assert "short_lease" not in (extracted_ok.get("signals") or [])
    assert extracted_ok.get("lease_years_remaining") == 86


def test_extract_short_lease_by_extension_required_keyword():
    extracted = extract_deal_signals({"description": "Lease extension required"})
    assert "short_lease" in (extracted.get("signals") or [])
    assert extracted.get("lease_years_remaining") is None
