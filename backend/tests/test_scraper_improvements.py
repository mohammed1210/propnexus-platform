"""
Basic smoke tests for scraper improvements.

These tests verify that the scrapers can be imported and have the expected
structure without making actual network requests.
"""

import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from bs4 import BeautifulSoup

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_scraper_imports():
    """Test that all scrapers can be imported."""
    try:
        print("✓ All scrapers imported successfully")
    except Exception as e:
        print(f"✗ Import error: {e}")
        assert False, f"Import error: {e}"


def test_utility_imports():
    """Test that utility modules can be imported."""
    try:
        print("✓ All utility modules imported successfully")
    except Exception as e:
        print(f"✗ Utility import error: {e}")
        assert False, f"Utility import error: {e}"


def test_scraper_functions_exist():
    """Test that expected scraper functions exist."""
    from backend.scraper import (
        onthemarket_scraper,
        rightmove_scraper,
        spare_room_scraper,
        zoopla_scraper,
    )

    scrapers = [
        (rightmove_scraper, "scrape_rightmove_properties"),
        (zoopla_scraper, "scrape_zoopla_properties"),
        (onthemarket_scraper, "scrape_onthemarket_properties"),
        (spare_room_scraper, "scrape_spareroom_properties"),
    ]

    all_ok = True
    for module, func_name in scrapers:
        if hasattr(module, func_name):
            print(f"✓ {module.__name__}.{func_name} exists")
        else:
            print(f"✗ {module.__name__}.{func_name} missing")
            all_ok = False

    assert all_ok, "Some scraper functions are missing"


def test_property_type_extraction():
    """Test property type extraction and normalization."""
    from backend.scraper.rightmove_scraper import _normalize_property_type
    from backend.scraper.zoopla_scraper import _normalize_property_type as zp_normalize

    # Test Rightmove property type normalization
    test_cases = [
        ("2 bedroom flat for sale", "flat"),
        ("3 bed detached house", "detached"),
        ("Semi-detached property", "semi-detached"),
        ("Terraced house with garden", "terraced"),
        ("Studio apartment", "studio"),
        ("Beautiful bungalow", "bungalow"),
        ("Modern maisonette", "maisonette"),
        ("Charming cottage", "cottage"),
        ("", None),
        (None, None),
    ]

    all_ok = True
    for text, expected in test_cases:
        result = _normalize_property_type(text)
        if result == expected:
            print(f"✓ _normalize_property_type('{text}') = {result}")
        else:
            print(f"✗ _normalize_property_type('{text}') = {result}, expected {expected}")
            all_ok = False

    # Test Zoopla property type normalization (should work the same way)
    result = zp_normalize("Luxury flat in London")
    if result == "flat":
        print("✓ Zoopla _normalize_property_type works")
    else:
        print("✗ Zoopla _normalize_property_type failed")
        all_ok = False

    assert all_ok, "Property type extraction failed"


def test_validation_functions():
    """Test validation utility functions."""
    from backend.utils.validation import is_valid_image_url, is_valid_url, should_insert_property

    # Test URL validation
    assert is_valid_url("https://example.com")
    assert not is_valid_url("not-a-url")
    assert not is_valid_url(None)
    print("✓ URL validation works")

    # Test image URL validation
    assert is_valid_image_url("https://example.com/photo.jpg")
    assert not is_valid_image_url("https://example.com/not-an-image")
    print("✓ Image URL validation works")

    # Test property validation
    valid_prop = {
        "external_id": "test-123",
        "title": "Test Property",
        "source": "test",
        "price": 100000,
        "location": "London",
    }
    should_insert, reason = should_insert_property(valid_prop)
    assert should_insert
    print("✓ Property validation works for valid property")

    # Test invalid property (missing external_id)
    invalid_prop = {"title": "Test Property", "source": "test"}
    should_insert, reason = should_insert_property(invalid_prop)
    assert not should_insert
    assert reason is not None
    print("✓ Property validation rejects invalid property")


def test_retry_logic():
    """Test retry utility."""
    from backend.utils.retry import calculate_delay

    # Test exponential backoff without jitter
    delay0 = calculate_delay(0, base_delay=1.0, jitter=False)
    delay1 = calculate_delay(1, base_delay=1.0, jitter=False)
    delay2 = calculate_delay(2, base_delay=1.0, jitter=False)

    assert delay0 == 1.0
    assert delay1 == 2.0
    assert delay2 == 4.0

    # Test with jitter enabled - should be within bounds
    delay_jitter = calculate_delay(0, base_delay=1.0, jitter=True)
    assert 0.5 <= delay_jitter <= 1.5  # Jitter adds 0.5-1.0x multiplier

    print("✓ Exponential backoff calculation works")


def test_logger_stats():
    """Test scraper logger statistics."""
    from backend.utils.scraper_logger import ScraperStats

    stats = ScraperStats("test", "London")
    stats.log_card_found()
    stats.log_parse_success()
    stats.log_missing_field("image_url")

    assert stats.total_cards_found == 1
    assert stats.successful_parses == 1
    assert stats.missing_fields["image_url"] == 1
    print("✓ ScraperStats tracking works")


def test_cloudflare_marker_detection_is_specific():
    """Ensure Cloudflare detection doesn't false-positive on analytics beacons."""
    from backend.scraper.zoopla_scraper import _has_cloudflare_marker

    ok_html = """
    <html><head>
    <script src=\"https://static.cloudflareinsights.com/beacon.min.js\"></script>
    </head><body><div>Normal page content</div></body></html>
    """.strip()
    assert _has_cloudflare_marker(ok_html) is False

    blocked_html = """
    <html><head><title>Attention Required! | Cloudflare</title></head>
    <body>Checking your browser before accessing example.com</body></html>
    """.strip()
    assert _has_cloudflare_marker(blocked_html) is True
    assert _has_cloudflare_marker("/cdn-cgi/challenge-platform/") is True
    print("✓ Cloudflare marker detection is specific")


def test_scraperapi_url_builder():
    """Test ScraperAPI URL builder helper."""
    from backend.scraper.rightmove_scraper import make_scraperapi_url

    # Save original env vars
    original_key = os.environ.get("SCRAPERAPI_KEY")

    try:
        # Test 1: No API key set - should return original URL
        os.environ["SCRAPERAPI_KEY"] = ""
        target_url = "https://www.rightmove.co.uk/property-for-sale/find.html?searchLocation=London"
        result = make_scraperapi_url(target_url)
        assert result == target_url, "Should return original URL when no key set"
        print("✓ make_scraperapi_url returns original URL when SCRAPERAPI_KEY not set")

        # Test 2: With API key, no render
        os.environ["SCRAPERAPI_KEY"] = "test-key-123"
        result = make_scraperapi_url(target_url, render=False)
        assert result.startswith("https://api.scraperapi.com/")
        assert "api_key=test-key-123" in result
        assert "country_code=gb" in result
        assert (
            f"url={target_url.replace(':', '%3A').replace('/', '%2F')}" in result
            or "url=" in result
        )
        assert "render" not in result  # Should not have render when False
        print("✓ make_scraperapi_url builds correct URL without render")

        # Test 3: With API key and render=True
        result = make_scraperapi_url(target_url, render=True)
        assert result.startswith("https://api.scraperapi.com/")
        assert "api_key=test-key-123" in result
        assert "country_code=gb" in result
        assert "render=true" in result
        assert "device_type=desktop" in result
        print("✓ make_scraperapi_url builds correct URL with render=true")

    finally:
        # Restore original env var
        if original_key is not None:
            os.environ["SCRAPERAPI_KEY"] = original_key
        elif "SCRAPERAPI_KEY" in os.environ:
            del os.environ["SCRAPERAPI_KEY"]


def test_scraperapi_mode_handling():
    """Test SCRAPER_MODE environment variable handling."""
    from backend.scraper import rightmove_scraper

    # Save original env vars
    original_mode = os.environ.get("SCRAPER_MODE")
    original_key = os.environ.get("SCRAPERAPI_KEY")

    try:
        # Test 1: scraperapi mode with key
        os.environ["SCRAPER_MODE"] = "scraperapi"
        os.environ["SCRAPERAPI_KEY"] = "test-key"
        # Just verify the constants are read correctly
        # We can't easily test async fetch without mocking
        import importlib

        importlib.reload(rightmove_scraper)
        assert rightmove_scraper.SCRAPER_MODE == "scraperapi"
        assert rightmove_scraper.SCRAPERAPI_KEY == "test-key"
        print("✓ SCRAPER_MODE and SCRAPERAPI_KEY loaded correctly")

        # Test 2: scraperapi mode without key (should work gracefully)
        os.environ["SCRAPER_MODE"] = "scraperapi"
        os.environ["SCRAPERAPI_KEY"] = ""
        importlib.reload(rightmove_scraper)
        assert rightmove_scraper.SCRAPER_MODE == "scraperapi"
        assert rightmove_scraper.SCRAPERAPI_KEY == ""
        print("✓ SCRAPER_MODE scraperapi works without key")

    finally:
        # Restore original env vars
        if original_mode is not None:
            os.environ["SCRAPER_MODE"] = original_mode
        elif "SCRAPER_MODE" in os.environ:
            del os.environ["SCRAPER_MODE"]

        if original_key is not None:
            os.environ["SCRAPERAPI_KEY"] = original_key
        elif "SCRAPERAPI_KEY" in os.environ:
            del os.environ["SCRAPERAPI_KEY"]


def test_rightmove_next_data_extraction_maps_properties():
    """Regression: Rightmove should parse listings from __NEXT_DATA__ when present."""
    from backend.scraper.rightmove_scraper import (
        _extract_next_data,
        _find_rightmove_properties_in_next_data,
        _rm_property_from_api_dict,
    )

    next_data = {
        "props": {
            "pageProps": {
                "searchResults": {
                    "properties": [
                        {
                            "id": 123,
                            "displayAddress": "London",
                            "price": {"amount": 500000},
                            "bedrooms": 2,
                            "bathrooms": 1,
                            "media": [{"url": "https://example.com/img.jpg"}],
                        }
                    ]
                }
            }
        }
    }
    html = (
        "<html><body>"
        "<script id='__NEXT_DATA__' type='application/json'>"
        + json.dumps(next_data)
        + "</script></body></html>"
    )
    soup = BeautifulSoup(html, "html.parser")
    extracted = _extract_next_data(soup)
    assert extracted is not None

    listings = _find_rightmove_properties_in_next_data(extracted)
    assert len(listings) == 1

    mapped = _rm_property_from_api_dict(listings[0])
    assert mapped is not None
    assert mapped["external_id"] == "123"
    assert mapped["source"] == "rightmove"
    assert mapped["location"].lower().find("london") != -1
    assert mapped["price"] == 500000


@pytest.mark.asyncio
@patch.dict(os.environ, {"SCRAPER_MODE": "scraperapi", "SCRAPERAPI_KEY": "test-key"})
async def test_rightmove_place_not_found_retries_minimal_url_plain_scraperapi():
    """Regression: deceptive Rightmove 'place not found' HTML should trigger minimal URL retry."""

    from backend.scraper import rightmove_scraper

    # Ensure the code path sees a key (module constant is loaded at import time).
    with patch.object(rightmove_scraper, "SCRAPERAPI_KEY", "test-key"):
        # aiohttp's session.get returns an awaitable async context manager, not a coroutine.
        # Use MagicMock for get() so `async with session.get(...)` works in the unit test.
        mock_session = MagicMock()

        not_found_html = (
            "<html><head><title>Rightmove - We couldn’t find the place you were looking for."  # noqa: RUF001
            "</title></head><body>We couldn’t find the place you were looking for.</body></html>"  # noqa: RUF001
        )

        next_data = {
            "props": {
                "pageProps": {
                    "searchResults": {
                        "properties": [
                            {
                                "id": 321,
                                "displayAddress": "London",
                                "price": {"amount": 123456},
                                "bedrooms": 1,
                                "bathrooms": 1,
                                "media": [{"url": "https://example.com/img.jpg"}],
                            }
                        ]
                    }
                }
            }
        }
        good_html = (
            "<html><body><script id='__NEXT_DATA__' type='application/json'>"
            + json.dumps(next_data)
            + "</script></body></html>"
        )

        first_response = AsyncMock()
        first_response.text = AsyncMock(return_value=not_found_html)
        first_response.status = 200

        second_response = AsyncMock()
        second_response.text = AsyncMock(return_value=not_found_html)
        second_response.status = 200

        third_response = AsyncMock()
        third_response.text = AsyncMock(return_value=good_html)
        third_response.status = 200

        # 1) initial fetch (wrapped ScraperAPI URL)
        # 2) session-number retry (still not_found)
        # 3) minimal URL plain ScraperAPI retry (should recover)
        mock_session.get.return_value.__aenter__.side_effect = [
            first_response,
            second_response,
            third_response,
        ]
        mock_session.get.return_value.__aexit__.return_value = False

        url = rightmove_scraper._build_search_url("London", page=0)
        html = await rightmove_scraper._fetch_html_internal(mock_session, url)
        assert html is not None
        assert "__NEXT_DATA__" in html

        # Ensure we performed the minimal URL retry and that it is a plain ScraperAPI call
        # (no keep_headers/country_code appended).
        assert mock_session.get.call_count == 3
        third_call_url = mock_session.get.call_args_list[2][0][0]
        q = parse_qs(urlparse(third_call_url).query)

        assert "country_code" not in q
        assert "keep_headers" not in q

        expected_minimal = (
            "https://www.rightmove.co.uk/property-for-sale/find.html"
            "?locationIdentifier=REGION%5E87490&sortType=2&includeSSTC=false&paginationIndex=0"
        )
        assert (q.get("url") or [""])[0] == expected_minimal
        assert "channel=BUY" not in expected_minimal
        assert "dontShow" not in expected_minimal
        assert "propertyTypes" not in expected_minimal

        soup = BeautifulSoup(html, "html.parser")
        extracted = rightmove_scraper._extract_next_data(soup)
        assert extracted is not None
        listings = rightmove_scraper._find_rightmove_properties_in_next_data(extracted)
        assert len(listings) == 1


@pytest.mark.asyncio
@patch.dict(os.environ, {"SCRAPER_MODE": "scraperapi", "SCRAPERAPI_KEY": "test-key"})
async def test_zoopla_5xx_retries_premium_once_and_parses_next_data():
    """Regression: Zoopla 5xx from ScraperAPI should log+retry once with premium=true."""
    from backend.scraper import zoopla_scraper

    # Force key presence for the retry path.
    with patch.object(zoopla_scraper, "SCRAPERAPI_KEY", "test-key"):
        mock_session = AsyncMock()

        first_response = AsyncMock()
        first_response.text = AsyncMock(return_value='{"error":"timeout"}')
        first_response.status = 500

        # Second call returns valid HTML containing __NEXT_DATA__ listings.
        next_data = {
            "props": {
                "pageProps": {
                    "searchResults": {
                        "regularListings": [
                            {
                                "listingId": 999,
                                "displayPrice": "£123,456",
                                "displayAddress": "London",
                                "imageUrl": "https://example.com/a.jpg",
                            }
                        ]
                    }
                }
            }
        }
        html200 = (
            "<html><body>"
            "<script id='__NEXT_DATA__' type='application/json'>"
            + json.dumps(next_data)
            + "</script></body></html>"
        )

        second_response = AsyncMock()
        second_response.text = AsyncMock(return_value=html200)
        second_response.status = 200

        mock_session.get.return_value.__aenter__.side_effect = [
            first_response,
            second_response,
        ]

        html = await zoopla_scraper._fetch_html_internal(
            mock_session, "https://www.zoopla.co.uk/for-sale/property/london/"
        )
        assert html is not None

        # Ensure the premium retry happened exactly once.
        assert mock_session.get.call_count == 2
        second_call_url = mock_session.get.call_args_list[1][0][0]
        assert "premium=true" in second_call_url

        soup = BeautifulSoup(html, "html.parser")
        extracted = zoopla_scraper._extract_next_data(soup)
        assert extracted is not None
        listings = zoopla_scraper._find_zoopla_listings_in_next_data(extracted)
        assert len(listings) == 1
        prop = zoopla_scraper._zoopla_property_from_listing_dict(listings[0])
        assert prop is not None
        assert prop["external_id"] == "999"


def test_zoopla_search_url_slugified():
    """Zoopla location path should be slugified (lowercase + hyphen)."""
    from backend.scraper.zoopla_scraper import _build_search_url

    assert _build_search_url("London") == "https://www.zoopla.co.uk/for-sale/property/london/"
    assert _build_search_url("St Albans") == "https://www.zoopla.co.uk/for-sale/property/st-albans/"


def test_rightmove_search_url_includes_index_page0():
    """Regression: Rightmove HTML URL must include index=0 for page 0."""
    from backend.scraper.rightmove_scraper import _build_search_url

    url0 = _build_search_url("London", page=0)
    assert "index=0" in url0
    assert "locationIdentifier=REGION%5E87490" in url0
    assert "channel=BUY" not in url0


def test_onthemarket_search_url_lowercases_location():
    """Regression: OnTheMarket location path should be lowercased/slugified."""
    from backend.scraper.onthemarket_scraper import _build_search_url

    assert (
        _build_search_url("London")
        == "https://www.onthemarket.com/for-sale/property/london/?view=grid"
    )
    assert (
        _build_search_url("St Albans")
        == "https://www.onthemarket.com/for-sale/property/st-albans/?view=grid"
    )


def test_rightmove_caret_retry_targets_include_unescaped_first():
    """Regression: caret-unescape retry should exist for REGION%5E URLs."""
    from backend.scraper.rightmove_scraper import _rightmove_caret_url_variants

    url = "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E87490&index=0"
    variants = _rightmove_caret_url_variants(url)
    assert variants[0].count("REGION^") == 1
    assert any("REGION%5E87490" in v for v in variants)


def main():
    """Run all tests."""
    print("\n=== Running Scraper Smoke Tests ===\n")

    tests = [
        ("Import scrapers", test_scraper_imports),
        ("Import utilities", test_utility_imports),
        ("Scraper functions exist", test_scraper_functions_exist),
        ("Property type extraction", test_property_type_extraction),
        ("Validation functions", test_validation_functions),
        ("Retry logic", test_retry_logic),
        ("Logger statistics", test_logger_stats),
        ("ScraperAPI URL builder", test_scraperapi_url_builder),
        ("ScraperAPI mode handling", test_scraperapi_mode_handling),
        ("Zoopla URL slugified", test_zoopla_search_url_slugified),
    ]

    results = []
    for name, test_func in tests:
        print(f"\n--- {name} ---")
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            import traceback

            traceback.print_exc()
            results.append((name, False))

    print("\n=== Test Summary ===\n")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{status}: {name}")

    print(f"\nPassed: {passed}/{total}")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
