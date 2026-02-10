import asyncio
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_onthemarket_scrape_uses_detail_links_when_cards_missing():
    from backend.scraper import onthemarket_scraper as otm

    listing_html = (
        "<html><body>"
        "<a href='/details/111111/'>A</a>"
        "<a href='/details/222222/'>B</a>" + ("x" * 9000) + "</body></html>"
    )

    detail_html = (
        "<html><head>"
        "<meta property='og:title' content='£123,456 2 bed flat, SW11 1AA'/>"
        "<meta property='og:description' content='£123,456'/>"
        "</head><body>"
        "<link rel='preload' as='image' href='https://media.onthemarket.com/properties/1/1/image-0-1024x1024.webp'/>"
        "</body></html>"
    )

    async def fake_fetch_html(_session, url: str):
        if "/for-sale/property/" in url:
            return listing_html
        if "/details/" in url:
            return detail_html
        return None

    with patch.object(otm, "_fetch_html", new=AsyncMock(side_effect=fake_fetch_html)):
        with patch.object(otm, "aiohttp") as _aiohttp:
            # We don't care about actual session usage since _fetch_html is patched.
            _aiohttp.ClientSession.return_value.__aenter__.return_value = object()
            _aiohttp.ClientSession.return_value.__aexit__.return_value = False
            out = await otm.scrape_onthemarket_properties("London", limit=1, max_pages=1)

    assert isinstance(out, list)
    assert len(out) == 1
    assert out[0].get("external_id") in ("ot-111111", "ot-222222")
    assert out[0].get("source") == "onthemarket"
    assert out[0].get("image_url")


@pytest.mark.asyncio
async def test_onthemarket_scrape_ignores_block_keyword_when_links_exist():
    from backend.scraper import onthemarket_scraper as otm

    listing_html = (
        "<html><head><title>captcha</title></head><body>"
        "captcha "
        "<a href='/details/999/'>Details</a>" + ("x" * 9000) + "</body></html>"
    )

    detail_html = (
        "<html><head>"
        "<meta property='og:title' content='£500,000 2 bed flat, SW11 1AA'/>"
        "<meta property='og:description' content='£500,000'/>"
        "</head><body>"
        "<link rel='preload' as='image' href='https://media.onthemarket.com/properties/1/1/image-0-1024x1024.webp'/>"
        "</body></html>"
    )

    async def fake_fetch_html(_session, url: str):
        if "/for-sale/property/" in url:
            return listing_html
        if "/details/999/" in url:
            return detail_html
        return None

    with patch.object(otm, "_fetch_html", new=AsyncMock(side_effect=fake_fetch_html)):
        with patch.object(otm, "aiohttp") as _aiohttp:
            _aiohttp.ClientSession.return_value.__aenter__.return_value = object()
            _aiohttp.ClientSession.return_value.__aexit__.return_value = False
            out = await otm.scrape_onthemarket_properties("London", limit=1, max_pages=1)

    assert isinstance(out, list)
    assert len(out) == 1
    assert out[0].get("external_id") == "ot-999"


@pytest.mark.asyncio
async def test_onthemarket_detail_phase_partial_success_with_timeouts(monkeypatch):
    from backend.scraper import onthemarket_scraper as otm

    monkeypatch.setattr(otm, "PLAYWRIGHT_ENABLE", False)
    monkeypatch.setattr(otm, "OTM_DETAIL_TIMEOUT_S", 0.05)
    monkeypatch.setattr(otm, "OTM_DETAIL_CONCURRENCY", 4)
    monkeypatch.setattr(otm, "OTM_DETAIL_FETCH_CAP", 40)
    monkeypatch.setattr(otm, "OTM_DETAIL_FETCH_MULTIPLIER", 2)

    detail_ids = [100000 + i for i in range(10)]
    listing_html = (
        "<html><body>"
        + "".join([f"<a href='/details/{i}/'>D</a>" for i in detail_ids])
        + ("x" * 9000)
        + "</body></html>"
    )

    detail_html = (
        "<html><head>"
        "<meta property='og:title' content='£123,456 2 bed flat, SW11 1AA'/>"
        "<meta property='og:description' content='£123,456'/>"
        "</head><body>"
        "<link rel='preload' as='image' href='https://media.onthemarket.com/properties/1/1/image-0-1024x1024.webp'/>"
        "</body></html>"
    )

    async def fake_fetch_html(_session, url: str):
        if "/for-sale/property/" in url:
            return listing_html
        if "/details/" in url:
            m = otm._DETAIL_ID_RE.search(url)
            pid = int(m.group("id")) if m else 0
            if pid in (100000, 100001, 100002):
                return detail_html
            if pid in (100003, 100004, 100005, 100006):
                await asyncio.sleep(0.2)
                return detail_html
            return None
        return None

    with patch.object(otm, "_fetch_html", new=AsyncMock(side_effect=fake_fetch_html)):
        with patch.object(otm, "aiohttp") as _aiohttp:
            _aiohttp.ClientSession.return_value.__aenter__.return_value = object()
            _aiohttp.ClientSession.return_value.__aexit__.return_value = False
            out, telem = await otm.scrape_onthemarket_properties(
                "London", limit=50, max_pages=1, return_telemetry=True
            )

    assert isinstance(out, list)
    assert len(out) == 3
    assert isinstance(telem, dict)
    assert telem.get("detail_fetch_attempted") == 10
    assert telem.get("detail_fetch_succeeded") == 3
    assert int(telem.get("detail_fetch_timed_out") or 0) >= 1
    assert int(telem.get("detail_fetch_failed") or 0) >= 1
    assert int(telem.get("detail_fetch_elapsed_ms") or 0) > 0


@pytest.mark.asyncio
async def test_onthemarket_detail_phase_cap_behavior(monkeypatch):
    from backend.scraper import onthemarket_scraper as otm

    monkeypatch.setattr(otm, "PLAYWRIGHT_ENABLE", False)
    monkeypatch.setattr(otm, "OTM_DETAIL_TIMEOUT_S", 0.2)
    monkeypatch.setattr(otm, "OTM_DETAIL_CONCURRENCY", 8)
    monkeypatch.setattr(otm, "OTM_DETAIL_FETCH_CAP", 40)
    monkeypatch.setattr(otm, "OTM_DETAIL_FETCH_MULTIPLIER", 2)

    detail_ids = [100000 + i for i in range(200)]
    listing_html = (
        "<html><body>"
        + "".join([f"<a href='/details/{i}/'>D</a>" for i in detail_ids])
        + ("x" * 9000)
        + "</body></html>"
    )

    detail_html = (
        "<html><head>"
        "<meta property='og:title' content='£123,456 2 bed flat, SW11 1AA'/>"
        "<meta property='og:description' content='£123,456'/>"
        "</head><body>"
        "<link rel='preload' as='image' href='https://media.onthemarket.com/properties/1/1/image-0-1024x1024.webp'/>"
        "</body></html>"
    )

    called_detail_urls: list[str] = []

    async def fake_fetch_html(_session, url: str):
        if "/for-sale/property/" in url:
            return listing_html
        if "/details/" in url:
            called_detail_urls.append(url)
            return detail_html
        return None

    with patch.object(otm, "_fetch_html", new=AsyncMock(side_effect=fake_fetch_html)):
        with patch.object(otm, "aiohttp") as _aiohttp:
            _aiohttp.ClientSession.return_value.__aenter__.return_value = object()
            _aiohttp.ClientSession.return_value.__aexit__.return_value = False
            _out, telem = await otm.scrape_onthemarket_properties(
                "London", limit=5, max_pages=1, return_telemetry=True
            )

    assert isinstance(telem, dict)
    assert telem.get("detail_links_found") == 200
    assert int(telem.get("detail_fetch_attempted") or 0) <= 10
    assert int(telem.get("detail_fetch_attempted") or 0) <= int(otm.OTM_DETAIL_FETCH_CAP)
    assert telem.get("detail_fetch_cap_applied") is True
    assert len(called_detail_urls) == int(telem.get("detail_fetch_attempted") or 0)
