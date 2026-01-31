from backend.scraper.utils import normalize_image_urls


def test_normalize_image_urls_removes_logos_svgs_and_prefers_high_res():
    urls = [
        # junk
        "https://www.onthemarket.com/assets/images/logo.svg",
        "https://example.com/_next/static/chunk.png",
        # zoopla variants (same image key, different resolution)
        "https://lid.zoocdn.com/u/480/360/abcd1234.jpg",
        "https://lid.zoocdn.com/u/1024/768/abcd1234.jpg",
        # rightmove non-photo
        "https://media.rightmove.co.uk/brand_logo.svg",
    ]

    out = normalize_image_urls(urls)

    assert all(".svg" not in u.lower() for u in out)
    assert all("_next/static" not in u.lower() for u in out)
    # Prefer higher resolution Zoopla variant
    assert out == ["https://lid.zoocdn.com/u/1024/768/abcd1234.jpg"]
