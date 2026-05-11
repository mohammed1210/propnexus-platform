from backend.scraper.search_utils import (
    build_onthemarket_top_deal_search_urls,
    build_rightmove_top_deal_search_urls,
    build_zoopla_top_deal_search_urls,
)


def test_rightmove_top_deal_urls_include_metadata():
    urls = build_rightmove_top_deal_search_urls("REGION^87490")
    assert len(urls) == 3
    labels = {u["metadata"]["sort_label"] for u in urls}
    assert labels == {"lowest_price", "oldest", "recently_reduced"}
    assert all("locationIdentifier=REGION^87490" in u["url"] for u in urls)
    assert all(u["metadata"]["strategy"] == "top_deal" for u in urls)


def test_zoopla_top_deal_urls_include_metadata():
    urls = build_zoopla_top_deal_search_urls("liverpool", max_pages=2)
    assert len(urls) == 6
    assert {u["metadata"]["portal"] for u in urls} == {"zoopla"}
    assert {u["metadata"]["page"] for u in urls} == {1, 2}


def test_onthemarket_top_deal_urls_include_metadata():
    urls = build_onthemarket_top_deal_search_urls("Manchester", max_pages=1)
    assert len(urls) == 3
    assert urls[0]["metadata"]["strategy"] == "top_deal"
    assert "manchester" in urls[0]["url"]
