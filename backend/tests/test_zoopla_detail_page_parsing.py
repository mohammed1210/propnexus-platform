from backend.scraper.zoopla_scraper import _parse_zoopla_detail_page


def test_parse_zoopla_detail_page_jsonld() -> None:
    url = "https://www.zoopla.co.uk/for-sale/details/12345678/"
    html = """
    <html>
      <head>
        <meta property="og:image" content="//cdn.example.com/fallback.jpg" />
      </head>
      <body>
        <script type="application/ld+json">
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
          "image": ["//img.example.com/a.jpg", "https://img.example.com/b.jpg"],
          "geo": {"latitude": 51.5, "longitude": -0.12}
        }
        </script>
      </body>
    </html>
    """

    parsed = _parse_zoopla_detail_page(html, url)
    assert parsed is not None
    assert parsed["external_id"] == "12345678"
    assert parsed["source"] == "zoopla"
    assert parsed["title"] == "Lovely Flat in London"
    assert parsed["location"] and "London" in parsed["location"]
    assert parsed["price"] == 450000
    assert parsed["image_url"].startswith("https://")
    assert parsed["image_urls"][0].startswith("https://")


def test_parse_zoopla_detail_page_title_price_and_preload_images() -> None:
    url = "https://www.zoopla.co.uk/for-sale/details/72258912/"
    html = """
    <html>
      <head>
        <title>Valence View - Plot 218 £445,000 - Zoopla</title>
        <meta property="og:image" content="//img.example.com/og.jpg" />
        <link rel="preload" as="image" href="//img.example.com/preload-1.jpg" />
        <link rel="preload" as="image" href="https://img.example.com/preload-2.jpg" />
      </head>
      <body>
        <div>2 bedroom apartment</div>
      </body>
    </html>
    """

    parsed = _parse_zoopla_detail_page(html, url)
    assert parsed is not None
    assert parsed["external_id"] == "72258912"
    assert parsed["price"] == 445000
    assert parsed["title"]
    assert parsed["image_urls"]
    assert parsed["image_urls"][0].startswith("https://")
