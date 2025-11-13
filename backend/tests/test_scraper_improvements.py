"""
Basic smoke tests for scraper improvements.

These tests verify that the scrapers can be imported and have the expected
structure without making actual network requests.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_scraper_imports():
    """Test that all scrapers can be imported."""
    try:
        from backend.scraper import rightmove_scraper
        from backend.scraper import zoopla_scraper
        from backend.scraper import onthemarket_scraper
        from backend.scraper import spare_room_scraper
        print("✓ All scrapers imported successfully")
        return True
    except Exception as e:
        print(f"✗ Import error: {e}")
        return False


def test_utility_imports():
    """Test that utility modules can be imported."""
    try:
        from backend.utils import scraper_logger
        from backend.utils import retry
        from backend.utils import validation
        print("✓ All utility modules imported successfully")
        return True
    except Exception as e:
        print(f"✗ Utility import error: {e}")
        return False


def test_scraper_functions_exist():
    """Test that expected scraper functions exist."""
    from backend.scraper import rightmove_scraper
    from backend.scraper import zoopla_scraper
    from backend.scraper import onthemarket_scraper
    from backend.scraper import spare_room_scraper
    
    scrapers = [
        (rightmove_scraper, 'scrape_rightmove_properties'),
        (zoopla_scraper, 'scrape_zoopla_properties'),
        (onthemarket_scraper, 'scrape_onthemarket_properties'),
        (spare_room_scraper, 'scrape_spareroom_properties'),
    ]
    
    all_ok = True
    for module, func_name in scrapers:
        if hasattr(module, func_name):
            print(f"✓ {module.__name__}.{func_name} exists")
        else:
            print(f"✗ {module.__name__}.{func_name} missing")
            all_ok = False
    
    return all_ok


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
        print(f"✓ Zoopla _normalize_property_type works")
    else:
        print(f"✗ Zoopla _normalize_property_type failed")
        all_ok = False
    
    return all_ok


def test_validation_functions():
    """Test validation utility functions."""
    from backend.utils.validation import (
        is_valid_url,
        is_valid_image_url,
        validate_property_data,
        should_insert_property,
        clean_property_data
    )
    
    # Test URL validation
    assert is_valid_url("https://example.com") == True
    assert is_valid_url("not-a-url") == False
    assert is_valid_url(None) == False
    print("✓ URL validation works")
    
    # Test image URL validation
    assert is_valid_image_url("https://example.com/photo.jpg") == True
    assert is_valid_image_url("https://example.com/not-an-image") == False
    print("✓ Image URL validation works")
    
    # Test property validation
    valid_prop = {
        "external_id": "test-123",
        "title": "Test Property",
        "source": "test",
        "price": 100000,
        "location": "London"
    }
    should_insert, reason = should_insert_property(valid_prop)
    assert should_insert == True
    print("✓ Property validation works for valid property")
    
    # Test invalid property (missing external_id)
    invalid_prop = {
        "title": "Test Property",
        "source": "test"
    }
    should_insert, reason = should_insert_property(invalid_prop)
    assert should_insert == False
    assert reason is not None
    print("✓ Property validation rejects invalid property")
    
    return True


def test_retry_logic():
    """Test retry utility."""
    from backend.utils.retry import calculate_delay
    
    # Test exponential backoff
    delay0 = calculate_delay(0, base_delay=1.0)
    delay1 = calculate_delay(1, base_delay=1.0)
    delay2 = calculate_delay(2, base_delay=1.0)
    
    assert delay0 == 1.0
    assert delay1 == 2.0
    assert delay2 == 4.0
    print("✓ Exponential backoff calculation works")
    
    return True


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
    
    return True


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
