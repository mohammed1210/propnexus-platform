import pytest

from backend.scraper.rightmove_scraper import (
    _extract_properties_from_rightmove_api_payload,
    _looks_like_html_document,
)


def _sample_property(pid: str = "123"):
    return {
        "id": pid,
        "displayAddress": "1 Example Street, London",
        "price": {"amount": 550000},
        "bedrooms": 2,
    }


def test_extract_properties_from_api_payload_top_level_properties():
    payload = {"properties": [_sample_property("1"), _sample_property("2")]}
    props = _extract_properties_from_rightmove_api_payload(payload)
    assert isinstance(props, list)
    assert len(props) == 2


def test_extract_properties_from_api_payload_nested_search_results():
    payload = {"searchResults": {"properties": [_sample_property("1")]}}
    props = _extract_properties_from_rightmove_api_payload(payload)
    assert isinstance(props, list)
    assert len(props) == 1


def test_extract_properties_from_api_payload_bounded_deep_scan():
    payload = {"a": {"b": {"c": {"properties": [_sample_property("1")]}}}}
    props = _extract_properties_from_rightmove_api_payload(payload)
    assert len(props) == 1


@pytest.mark.parametrize(
    "text,expected",
    [
        ("<!doctype html><html><head></head><body>hi</body></html>", True),
        ("   <html><body>hi</body></html>", True),
        ('{"properties": []}', False),
        ("", False),
        (None, False),
    ],
)
def test_looks_like_html_document(text, expected):
    assert _looks_like_html_document(text) is expected
