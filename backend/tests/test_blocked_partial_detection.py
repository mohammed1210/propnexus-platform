from __future__ import annotations

from backend.scraper.utils import detect_blocked_or_partial


def test_detect_blocked_http_status() -> None:
    assert detect_blocked_or_partial("<html></html>", 403) == "http_403"
    assert detect_blocked_or_partial("<html></html>", 429) == "http_429"


def test_detect_blocked_keywords() -> None:
    html = "<html><body>Please complete the CAPTCHA to continue</body></html>"
    assert detect_blocked_or_partial(html, 200) == "block_keyword"


def test_detect_consent_wall_keywords() -> None:
    html = "<html><body>We use cookies and consent is required</body></html>"
    assert detect_blocked_or_partial(html, 200) == "consent_wall"


def test_detect_small_payload_invalid_html() -> None:
    # Small + not valid HTML => treat as partial/blocked.
    html = "{" + "a" * 200 + "}"
    assert detect_blocked_or_partial(html, 200, min_html_bytes=30_000) == "small_payload_invalid"


def test_detect_blocked_title() -> None:
    html = "<html><head><title>Access Denied</title></head><body>nope</body></html>"
    # Make payload large enough to bypass the size heuristic.
    html = html + (" " * 40000)
    assert detect_blocked_or_partial(html, 200, min_html_bytes=30_000) in (
        "block_keyword",
        "blocked_title",
    )
