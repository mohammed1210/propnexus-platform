import pytest


@pytest.mark.asyncio
async def test_zoopla_detail_fallback_when_cards_invalid(monkeypatch) -> None:
    from backend.scraper import zoopla_scraper as zs

    # Force a single page and no delay for the test.
    monkeypatch.setattr(zs, "ZP_MAX_PAGES", 1)
    monkeypatch.setattr(zs, "ZP_DELAY_MS", 0)

    search_html = """
    <html>
      <head><title>Property for sale in London - Zoopla</title></head>
      <body>
        <!-- Has a detail link, but no card fields like h2/price/etc -->
        <div class='results'>
          <a href='/for-sale/details/12345678/'>View details</a>
        </div>
      </body>
    </html>
    """

    detail_html = """
    <html>
      <head>
        <meta property='og:image' content='//cdn.example.com/fallback.jpg' />
      </head>
      <body>
        <script type='application/ld+json'>
        {
          "@context": "https://schema.org",
          "@type": "Residence",
          "name": "Lovely Flat in London",
          "address": {
            "streetAddress": "1 High Street",
            "addressLocality": "London",
            "postalCode": "N1 1AA"
          },
          "offers": {"price": "450000"},
          "image": ["//img.example.com/a.jpg"],
          "geo": {"latitude": 51.5, "longitude": -0.12}
        }
        </script>
      </body>
    </html>
    """

    async def fake_fetch_html(session, url: str):
        if "/for-sale/property/london/" in url:
            return search_html
        if "/for-sale/details/12345678/" in url:
            return detail_html
        return ""

    monkeypatch.setattr(zs, "_fetch_html", fake_fetch_html)

    results = await zs.scrape_zoopla_properties("London", limit=5)
    assert any(r.get("external_id") == "12345678" for r in results)
