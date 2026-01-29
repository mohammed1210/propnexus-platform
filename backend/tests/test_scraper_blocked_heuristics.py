import backend.scraper.onthemarket_scraper as otm
import backend.scraper.spare_room_scraper as sr
from backend.scraper.zoopla_scraper import _extract_next_data_from_html


def test_spare_room_looks_blocked_does_not_trip_on_meta_robots():
    html = """<html><head><meta name=\"robots\" content=\"noindex,nofollow\"></head><body>
    <div class=\"listing\">Room</div>
    </body></html>"""
    assert sr._looks_blocked(html, 200) is False


def test_spare_room_looks_blocked_flags_human_challenge_phrase():
    html = "<html><body>Please verify you are human</body></html>"
    assert sr._looks_blocked(html, 200) is True


def test_onthemarket_looks_blocked_does_not_trip_on_meta_robots():
    html = """<html><head><meta name=\"robots\" content=\"noindex,nofollow\"></head><body>
    <div data-testid=\"property-card\">Card</div>
    </body></html>"""
    assert otm._looks_blocked(html, 200) is False


def test_onthemarket_looks_blocked_flags_human_challenge_phrase():
    html = "<html><body>Are you a robot?</body></html>"
    assert otm._looks_blocked(html, 200) is True


def test_onthemarket_looks_blocked_flags_short_403_body():
    html = "<html><head><title>Access denied</title></head><body>Denied</body></html>"
    assert otm._looks_blocked(html, 403) is True


def test_zoopla_extract_next_data_from_html_regex_fallback():
    html = (
        "<html><head></head><body>"
        '<script id="__NEXT_DATA__" type="application/json">'
        '{"props":{"pageProps":{"results":[{"listingId":123,"displayAddress":"X"}]}}}'
        "</script>"
        "</body></html>"
    )
    data = _extract_next_data_from_html(html)
    assert isinstance(data, dict)
    assert data["props"]["pageProps"]["results"][0]["listingId"] == 123
