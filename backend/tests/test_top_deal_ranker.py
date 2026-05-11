from backend.utils.top_deal_ranker import (
    apply_top_deal_ranking,
    rank_top_deal_candidates,
    score_top_deal_candidate,
)


def base_row(**extra):
    row = {
        "title": "Reduced 3 bed terrace investment opportunity",
        "description": "Price reduced. Chain free. Needs modernisation.",
        "price": 180000,
        "source_url": "https://www.rightmove.co.uk/properties/123",
        "image_urls": ["https://img/1.jpg", "https://img/2.jpg"],
        "data": {
            "search_metadata": {
                "strategy": "top_deal",
                "portal": "rightmove",
                "sort_label": "recently_reduced",
            }
        },
    }
    row.update(extra)
    return row


def test_scores_explicit_deal_signals_and_search_metadata():
    result = score_top_deal_candidate(base_row())
    assert result["score"] >= 50
    assert result["tier"] in {"emerging", "strong", "prime"}
    assert any("reduced" in r.lower() for r in result["reasons"])
    assert result["evidence"]["search_metadata"]["portal"] == "rightmove"


def test_bmv_requires_sold_comps_evidence():
    without_comps = score_top_deal_candidate(base_row(description="Below market value BMV bargain"))
    assert without_comps["bmv_evidence"] is False
    assert without_comps["discount_vs_comps_pct"] is None

    with_comps = score_top_deal_candidate(
        base_row(price=160000),
        sold_comps={"count": 5, "median_price": 200000, "items": []},
    )
    assert with_comps["bmv_evidence"] is True
    assert with_comps["discount_vs_comps_pct"] == 20.0
    assert any(
        "sold-comps" in r.lower() or "sold comps" in r.lower() for r in with_comps["reasons"]
    )


def test_proxy_rent_does_not_add_verified_rent_points():
    proxy = score_top_deal_candidate(
        base_row(
            yield_percent=12, roi_percent=22, score_breakdown={"inputs": {"rent_source": "proxy"}}
        )
    )
    verified = score_top_deal_candidate(
        base_row(yield_percent=12, roi_percent=22, rent_confidence="provided")
    )
    assert verified["score"] > proxy["score"]
    assert not any("verified rent" in r.lower() for r in proxy["reasons"])


def test_missing_source_url_and_price_are_penalised():
    complete = score_top_deal_candidate(base_row())
    weak = score_top_deal_candidate(base_row(price=None, source_url=None, url=None))
    assert complete["score"] > weak["score"]


def test_luxury_outlier_is_penalised():
    normal = score_top_deal_candidate(base_row(price=250000))
    luxury = score_top_deal_candidate(base_row(price=2_000_000, title="Luxury penthouse"))
    assert normal["score"] > luxury["score"]
    assert luxury["evidence"].get("luxury_outlier") is True


def test_rank_top_deal_candidates_orders_by_top_score():
    rows = [
        base_row(title="weak", description="", price=None, source_url=None, image_urls=[]),
        base_row(title="strong", description="Reduced auction needs modernisation"),
    ]
    ranked = rank_top_deal_candidates(rows)
    assert ranked[0]["title"] == "strong"
    assert "top_deal_score" in ranked[0]
    assert isinstance(ranked[0]["top_deal_reasons"], list)


def test_apply_top_deal_ranking_embeds_explainability():
    row = apply_top_deal_ranking(base_row())
    assert row["top_deal_score"] == row["data"]["top_deal"]["score"]
    assert row["top_deal_tier"] == row["data"]["top_deal"]["tier"]


def test_oldest_search_pass_reason_is_explainable():
    result = score_top_deal_candidate(
        base_row(data={"search_metadata": {"strategy": "top_deal", "sort_label": "oldest"}})
    )
    assert any("stale stock" in r.lower() for r in result["reasons"])


def test_lowest_price_search_pass_reason_is_explainable():
    result = score_top_deal_candidate(
        base_row(data={"search_metadata": {"strategy": "top_deal", "sort_label": "lowest_price"}})
    )
    assert any("low-price" in r.lower() for r in result["reasons"])


def test_comp_count_below_threshold_does_not_create_bmv_evidence():
    result = score_top_deal_candidate(
        base_row(price=100000),
        sold_comps={"count": 2, "median_price": 200000},
    )
    assert result["bmv_evidence"] is False
    assert result["discount_vs_comps_pct"] is None


def test_reasons_are_deduplicated_and_limited():
    row = base_row(
        description="Reduced reduced price reduced auction needs modernisation chain free tenant in situ cash buyers only short lease guide price motivated seller"
    )
    result = score_top_deal_candidate(row)
    assert len(result["reasons"]) <= 5
    assert len(result["reasons"]) == len(set(result["reasons"]))


def test_image_count_improves_score_without_fake_claims():
    no_images = score_top_deal_candidate(base_row(image_urls=[]))
    with_images = score_top_deal_candidate(
        base_row(image_urls=["1.jpg", "2.jpg", "3.jpg", "4.jpg"])
    )
    assert with_images["score"] > no_images["score"]
    assert not any("bmv" in r.lower() for r in with_images["reasons"])
