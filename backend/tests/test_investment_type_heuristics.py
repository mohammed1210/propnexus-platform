from __future__ import annotations

from backend.utils.ingest import normalize_record


def test_investment_type_classifier_hmo():
    out = normalize_record(
        {
            "title": "Licensed HMO investment",
            "description": "Rooms to let, great yield",
            "price": 250000,
        },
        source="zoopla",
    )
    assert out.get("investment_type") == "HMO"


def test_investment_type_classifier_sa():
    out = normalize_record(
        {
            "title": "Serviced accommodation opportunity",
            "description": "Perfect for Airbnb short let",
            "price": 350000,
        },
        source="rightmove",
    )
    assert out.get("investment_type") == "SA"


def test_investment_type_classifier_default_btl():
    out = normalize_record(
        {
            "title": "2 bed flat",
            "description": "Great rental demand",
            "price": 200000,
        },
        source="onthemarket",
    )
    assert out.get("investment_type") == "BTL"
