from __future__ import annotations

from backend.utils.deal_signals import extract_deal_signals


def test_extract_deal_signals_reduced_and_discount_estimate():
    row = {
        "title": "Price reduced",
        "description": "Was £200,000 now £180,000",
        "url": "https://example.com/listing/1",
    }
    out = extract_deal_signals(row)
    assert isinstance(out, dict)
    assert "reduced" in (out.get("signals") or [])
    disc = out.get("discount_estimate_pct")
    assert isinstance(disc, (int, float))
    assert 5 <= float(disc) <= 15


def test_extract_deal_signals_auction_and_guide_price():
    row = {
        "title": "Guide price - auction",
        "description": "For sale by auction. Guide price £150,000.",
    }
    out = extract_deal_signals(row)
    sigs = out.get("signals") or []
    assert "auction" in sigs
    assert "guide_price" in sigs


def test_extract_deal_signals_needs_refurb_and_tenanted():
    row = {
        "title": "Needs refurbishment - tenanted investment",
        "description": "Currently tenanted, in need of modernisation.",
    }
    out = extract_deal_signals(row)
    sigs = out.get("signals") or []
    assert "needs_refurb" in sigs
    assert "tenanted" in sigs
