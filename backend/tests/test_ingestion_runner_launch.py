import logging

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


def test_worker_config_parser_respects_ingest_sources(monkeypatch):
    monkeypatch.setenv("INGEST_SOURCES", " Zoopla, onthemarket ,, spareroom ")

    assert ingestion_runner._load_sources() == ["zoopla", "onthemarket", "spareroom"]


def test_scraperapi_mode_without_key_is_coerced_to_direct(monkeypatch):
    monkeypatch.setenv("SCRAPER_MODE", "scraperapi")
    monkeypatch.delenv("SCRAPERAPI_KEY", raising=False)

    assert ingestion_runner._effective_scraper_mode() == "direct"


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


def test_direct_mode_disables_scraperapi_fallback_even_if_key_exists(monkeypatch):
    monkeypatch.setenv("SCRAPER_MODE", "direct")
    monkeypatch.setenv("SCRAPERAPI_KEY", "stale-secret-value")
    monkeypatch.delenv("SCRAPERAPI_ALLOW_FALLBACK", raising=False)

    ingestion_runner._apply_scraperapi_launch_policy()

    assert "SCRAPERAPI_KEY" not in __import__("os").environ


def test_startup_summary_does_not_expose_secrets(monkeypatch, caplog):
    monkeypatch.setenv("SCRAPER_MODE", "direct")
    monkeypatch.setenv("SCRAPERAPI_KEY", "super-secret-value")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "another-secret-value")
    monkeypatch.setenv("INGEST_SOURCES", "zoopla")
    monkeypatch.setattr(ingestion_runner, "sb", object())

    summary = ingestion_runner.get_worker_startup_summary()
    with caplog.at_level(logging.INFO):
        ingestion_runner.log_worker_startup_summary(summary)

    rendered = "\n".join(record.getMessage() for record in caplog.records)
    assert "super-secret-value" not in rendered
    assert "another-secret-value" not in rendered
    assert "scraperapi_configured=False" in rendered
    assert "supabase_configured=True" in rendered
