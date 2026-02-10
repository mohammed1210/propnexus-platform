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
