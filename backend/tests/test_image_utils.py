import backend.scraper.onthemarket_scraper as otm
from backend.utils.image_utils import dedupe_image_urls, pick_cover_image


def test_dedupe_image_urls_strips_query_and_dedupes_by_basename():
    urls = [
        "https://example.com/img/photo.jpg?sig=aaa",
        "https://example.com/img/photo.jpg?sig=bbb",
        "https://example.com/img/other.jpg",
    ]

    out = dedupe_image_urls(urls)

    # Query should be stripped for stable dedupe.
    assert "https://example.com/img/photo.jpg" in out
    assert all("?" not in u for u in out)

    # Only one variant of photo.jpg should remain.
    assert sum(1 for u in out if u.endswith("/photo.jpg")) == 1


def test_pick_cover_image_avoids_floorplan_when_possible():
    urls = [
        "https://example.com/img/floorplan-1024x768.jpg",
        "https://example.com/img/photo-640x480.jpg",
    ]
    assert pick_cover_image(urls).endswith("photo-640x480.jpg")


def test_otm_gallery_extracts_images_from_next_data_when_present():
    html = (
        "<html><body>"
        '<script id="__NEXT_DATA__" type="application/json">'
        '{"props":{"pageProps":{"images":["https://media.onthemarket.com/properties/123/photo-1024x768.jpg"]}}}'
        "</script>"
        "</body></html>"
    )

    imgs = otm._extract_otm_gallery_image_urls(html, "https://www.onthemarket.com/details/123/")
    assert isinstance(imgs, list)
    assert any("media.onthemarket.com/properties/123/photo" in u for u in imgs)
