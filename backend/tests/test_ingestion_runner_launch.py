import pytest

from backend.tasks import ingestion_runner


@pytest.mark.asyncio
async def test_source_allow_list_is_respected(monkeypatch):
    seen = {}

    async def fake_scrape(location, *, sources=None, on_source_complete=None, **_kwargs):
        seen["location"] = location
        seen["sources"] = sources
        if on_source_complete:
            await on_source_complete("zoopla", [], "empty", None, None)
        return []

    monkeypatch.setattr(ingestion_runner, "scrape_all_sources", fake_scrape)
    monkeypatch.setattr(ingestion_runner, "sb", None)
    total = await ingestion_runner._ingest_location("London", sources=["zoopla"])
    assert total == 0
    assert seen["sources"] == ["zoopla"]


@pytest.mark.asyncio
async def test_missing_scraperapi_env_does_not_crash_direct_mode(monkeypatch):
    monkeypatch.delenv("SCRAPERAPI_KEY", raising=False)
    monkeypatch.setenv("SCRAPER_MODE", "direct")

    async def fake_scrape(*_args, **_kwargs):
        return []

    monkeypatch.setattr(ingestion_runner, "scrape_all_sources", fake_scrape)
    monkeypatch.setattr(ingestion_runner, "sb", None)
    total = await ingestion_runner._ingest_location("London", sources=["zoopla"])
    assert total == 0


@pytest.mark.asyncio
async def test_runner_continues_after_one_location_error(monkeypatch):
    calls = []

    async def fake_ingest(location, **_kwargs):
        calls.append(location)
        if location == "Bad":
            raise RuntimeError("boom")
        return 3

    monkeypatch.setenv("INGEST_LOCATIONS", "Bad,Good")
    monkeypatch.setenv("INGEST_BATCH_SLEEP_MS", "0")
    monkeypatch.setattr(ingestion_runner, "_ingest_location", fake_ingest)
    total = await ingestion_runner.run_cycle()
    assert calls == ["Bad", "Good"]
    assert total == 3
