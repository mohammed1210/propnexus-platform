from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_probe_onthemarket_playwright_escalation_fields_present_when_blocked():
    """When OTM looks blocked and include_escalation=true, the probe should attempt Playwright."""

    from backend.routes import debug_scrape_probe as probe

    blocked_html = "<html><body>captcha</body></html>"
    rendered_html = (
        "<html><body>"
        "<a href='/details/123456/'>Details</a>"
        "<div class='property-card'>card</div>" + ("x" * 9000) + "</body></html>"
    )

    async def fake_fetch_text(*args, **kwargs):
        return 200, blocked_html

    with patch.object(probe, "_fetch_text", new=AsyncMock(side_effect=fake_fetch_text)):
        with patch("backend.utils.render.PLAYWRIGHT_ENABLE", True):
            with patch(
                "backend.utils.render.render_page_with_diag",
                new=AsyncMock(return_value=(rendered_html, {"error": None})),
            ):
                out = await probe._probe_onthemarket(  # type: ignore[attr-defined]
                    session=None,
                    location="London",
                    page=0,
                    timeout_seconds=10,
                    include_escalation=True,
                )

    # Core contract: probe exposes explicit Playwright attempt signals.
    assert out.get("playwright_attempted") is True
    assert out.get("escalation_used") == "playwright"
    assert out.get("playwright_html_len", 0) > 0
    assert isinstance(out.get("playwright_html_snippet"), str)
    assert out.get("playwright_error") in (None, "")

    # And it should switch to using the rendered HTML if it looks usable.
    assert out.get("fetch_via") == "playwright_fallback"
    assert out.get("retry_mode_used") == "playwright_fallback"
    assert out.get("blocked") is False
    assert out.get("classification") in ("ok", "parsed_links_only", "fetched_no_cards")


@pytest.mark.asyncio
async def test_probe_onthemarket_does_not_mark_blocked_when_ids_or_links_exist_with_block_keyword():
    """Regression: OTM listing pages may contain the word 'blocked' but still include real data signals."""

    from backend.routes import debug_scrape_probe as probe

    # Contains a generic block keyword, but also contains detail links and dataLayer ids.
    html = (
        "<html><head><title>blocked</title></head><body>"
        "blocked "
        "<script>window.dataLayer=window.dataLayer||[];"
        'window.dataLayer.push({"property-ids":[123456,234567,345678]});'
        "</script>"
        "<a href='/details/123456/'>Details</a>"
        "<a href='/details/234567/'>Details</a>" + ("x" * 9000) + "</body></html>"
    )

    async def fake_fetch_text(*args, **kwargs):
        return 200, html

    with patch.object(probe, "_fetch_text", new=AsyncMock(side_effect=fake_fetch_text)):
        out = await probe._probe_onthemarket(  # type: ignore[attr-defined]
            session=None,
            location="London",
            page=0,
            timeout_seconds=10,
            include_escalation=False,
        )

    assert out.get("property_ids_found") == 3
    assert out.get("detail_links_found", 0) >= 2
    assert isinstance(out.get("blocked_meta"), dict)
    assert out.get("blocked_meta", {}).get("keyword") == "blocked"
    assert out.get("blocked") is False
    assert out.get("classification") in ("ok", "parsed_links_only", "fetched_no_cards")
