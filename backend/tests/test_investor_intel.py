from backend.services.investor_intel import build_investor_intel_payload, offer_calculations
from backend.utils.ppd_comps import build_sold_comp_benchmark
from backend.utils.top_deal_ranker import score_top_deal_candidate


def test_offer_calculations_use_evidenced_rent_only():
    calc = offer_calculations(200000, 1000)

    assert calc["rent_required_at_asking"]["7"] == 1166.67
    assert calc["target_purchase_price_from_rent"]["7"] == 171429
    assert calc["price_gap_to_7pct_yield"] == 28571


def test_investor_intel_missing_rent_does_not_invent_offer_target():
    payload = build_investor_intel_payload(
        {"id": "p1", "price": 200000, "postcode": "SW1A 1AA"}, comps={"sales": [], "rents": []}
    )

    assert payload["rent_evidence"]["quality"] == "missing"
    assert payload["offer_intelligence"]["target_purchase_price_from_rent"]["7"] is None
    assert (
        payload["conclusion"] == "Insufficient rent evidence to calculate a reliable offer target."
    )


def test_sold_comp_benchmark_subject_gap():
    benchmark = build_sold_comp_benchmark(
        [
            {
                "price": 210000,
                "match_level": "exact",
                "date": "2026-01-01",
                "property_type": "flat",
            },
            {
                "price": 220000,
                "match_level": "exact",
                "date": "2025-12-01",
                "property_type": "flat",
            },
            {
                "price": 230000,
                "match_level": "sector",
                "date": "2025-11-01",
                "property_type": "flat",
            },
        ],
        subject_price=200000,
        subject_property_type="flat",
    )

    assert benchmark["similar_sales_count"] == 3
    assert benchmark["median_similar_price"] == 220000
    assert benchmark["subject_vs_median_pct"] == -9.1


def test_top_deal_strict_tiering_requires_hard_evidence():
    weak = score_top_deal_candidate(
        {
            "price": 100000,
            "source_url": "https://example.test/listing",
            "image_urls": ["https://example.test/1.jpg"],
            "search_metadata": {"strategy": "top_deal", "sort_label": "lowest_price"},
            "description": "Standard listing with no verified reduction or rent evidence",
        }
    )

    assert weak["tier"] in {"watchlist", "standard"}
    assert weak["evidence"]["hard_signal_count"] == 0


def test_verified_reduction_counts_as_hard_evidence():
    strong = score_top_deal_candidate(
        {
            "price": 180000,
            "previous_price": 220000,
            "price_change_count": 1,
            "last_price_change_at": "2026-05-01T00:00:00Z",
            "first_seen_at": "2026-03-01T00:00:00Z",
            "source_url": "https://example.test/listing",
            "image_urls": ["https://example.test/1.jpg"],
            "description": "Needs modernisation",
        },
        sold_comps={"median_similar_price": 230000, "similar_sales_count": 4},
    )

    assert strong["tier"] in {"prime", "strong"}
    assert strong["evidence"]["hard_signal_count"] >= 1
    assert "listing_history" in strong["evidence"]["evidence_categories"]
