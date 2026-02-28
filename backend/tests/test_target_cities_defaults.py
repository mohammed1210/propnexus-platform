from backend.scraper.utils import TARGET_CITIES


def test_target_cities_includes_birmingham() -> None:
    # /import/batch uses TARGET_CITIES when no cities payload is provided.
    # Birmingham is a default market and should not be removed silently.
    assert "Birmingham" in TARGET_CITIES
