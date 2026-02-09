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
                "backend.utils.render.render_page", new=AsyncMock(return_value=rendered_html)
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

    # And it should switch to using the rendered HTML if it looks usable.
    assert out.get("fetch_via") == "playwright_fallback"
    assert out.get("retry_mode_used") == "playwright_fallback"
    assert out.get("blocked") is False
    assert out.get("classification") in ("ok", "parsed_links_only", "fetched_no_cards")
