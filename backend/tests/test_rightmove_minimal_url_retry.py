import json

import pytest


class _MockResponse:
    def __init__(self, *, status: int, body: str):
        self.status = status
        self._body = body

    async def text(self) -> str:
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _MockSession:
    def __init__(self, *, minimal_target: str, initial_html: str, recovered_html: str):
        self._minimal_target = minimal_target
        self._initial_html = initial_html
        self._recovered_html = recovered_html
        self.calls: list[str] = []

    def get(self, url: str, headers=None, timeout=None):
        self.calls.append(url)
        if self._minimal_target in url:
            return _MockResponse(status=200, body=self._recovered_html)
        return _MockResponse(status=200, body=self._initial_html)


@pytest.mark.asyncio
async def test_rightmove_minimal_url_retry_drops_session_pinning(monkeypatch):
    """Regression test for Rightmove 'place not found' ScraperAPI variant.

    Ensures that when the deceptive 200 OK 'place not found' HTML is returned under
    SCRAPER_MODE=scraperapi, we retry the support-confirmed minimal URL using a *plain*
    ScraperAPI call (no keep_headers/session pinning) and recover a payload containing
    Next.js __NEXT_DATA__.
    """

    from backend.scraper import rightmove_scraper as rm

    monkeypatch.setenv("SCRAPER_MODE", "scraperapi")
    monkeypatch.setenv("SCRAPERAPI_KEY", "test_key")
    monkeypatch.setattr(rm, "SCRAPERAPI_KEY", "test_key")

    # The known-bad variant: 200 OK but no cards/Next.js signals.
    initial_html = "<html><head><title>Page not found</title></head><body>We couldn't find the place you were looking for</body></html>"

    # The recovered variant: includes Next.js payload marker.
    recovered_html = (
        "<html><head><title>Rightmove</title></head><body>"
        '<script id="__NEXT_DATA__">{}</script>'
        "</body></html>"
    )

    calls: list[tuple[str, dict]] = []

    def fake_make_scraperapi_url(target_url: str, **kwargs) -> str:
        calls.append((target_url, kwargs))
        # Deterministic proxy URL that still embeds the target URL for routing.
        return f"proxy://{target_url}|{json.dumps(kwargs, sort_keys=True)}"

    monkeypatch.setattr(rm, "make_scraperapi_url", fake_make_scraperapi_url)

    url = rm._build_minimal_region_find_url("REGION%5E87490", 0)
    minimal_target = url

    # Use a non-minimal URL for the initial call (but same locationIdentifier) to
    # ensure the minimal URL is built and retried.
    initial_url = (
        "https://www.rightmove.co.uk/property-for-sale/find.html"
        "?locationIdentifier=REGION%5E87490&sortType=2&includeSSTC=false&index=0"
        "&propertyTypes=&mustHave=&dontShow=houseShare%2Cretirement%2CsharedOwnership"
    )

    session = _MockSession(
        minimal_target=minimal_target,
        initial_html=initial_html,
        recovered_html=recovered_html,
    )

    out = await rm._fetch_html_internal(session, initial_url)

    assert out is not None
    assert "__NEXT_DATA__" in out

    # Ensure we performed at least one retry call.
    assert len(session.calls) >= 2

    # Find the call that targets the minimal URL with *plain* ScraperAPI options.
    minimal_calls = [(t, kw) for (t, kw) in calls if t == minimal_target]
    assert minimal_calls, "Expected minimal URL retry to be attempted"

    # The first minimal retry must be plain: no keep_headers and no session pinning.
    _t, kwargs = minimal_calls[0]
    assert kwargs.get("keep_headers") is None
    assert kwargs.get("session_number") is None
    assert kwargs.get("auto_session_number") is False
