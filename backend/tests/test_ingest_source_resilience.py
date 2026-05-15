import sys
import types

import pytest

from backend.utils.ingest import scrape_all_sources


@pytest.mark.asyncio
async def test_one_failing_source_does_not_terminate_aggregator(monkeypatch):
    zoopla_module = types.ModuleType("backend.scraper.zoopla_scraper")
    onthemarket_module = types.ModuleType("backend.scraper.onthemarket_scraper")

    def fail_zoopla(_location, max_pages=None):
        raise RuntimeError("blocked")

    def ok_onthemarket(_location, max_pages=None, return_telemetry=False):
        return [
            {
                "title": "Direct source listing",
                "price": "250000",
                "location": "London N1",
                "listing_url": "https://www.onthemarket.com/details/123456/",
            }
        ]

    zoopla_module.scrape_zoopla_properties = fail_zoopla
    onthemarket_module.scrape_onthemarket_properties = ok_onthemarket
    monkeypatch.setitem(sys.modules, "backend.scraper.zoopla_scraper", zoopla_module)
    monkeypatch.setitem(
        sys.modules,
        "backend.scraper.onthemarket_scraper",
        onthemarket_module,
    )

    source_statuses = {}

    async def on_source_complete(source, items, status, error, telemetry=None):
        source_statuses[source] = {"count": len(items), "status": status, "error": error}

    results = await scrape_all_sources(
        "London",
        sources=["zoopla", "onthemarket"],
        timeout_s=1,
        on_source_complete=on_source_complete,
    )

    assert len(results) == 1
    assert results[0]["source"] == "onthemarket"
    assert source_statuses["zoopla"]["status"] == "error"
    assert source_statuses["onthemarket"]["status"] == "success"
