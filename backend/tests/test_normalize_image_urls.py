from backend.scraper.utils import normalize_image_urls


def test_normalize_image_urls_filters_non_photos_and_prefers_highest_res_zoopla():
    urls = [
        "https://lid.zoocdn.com/u/480/360/f28a6d1589e187341221784a8ebc5270819697f0.jpg",
        "https://st.zoocdn.com/zoopla_static_agent_logo_(695810).png",
        "https://cdn.prod.zoopla.co.uk/_next/static/images/vauxhall-simple-logo.svg",
        "https://cdn.prod.zoopla.co.uk/_next/static/images/error-image.svg",
        "https://lid.zoocdn.com/u/480/360/f28a6d1589e187341221784a8ebc5270819697f0.jpg:p",
        "https://lid.zoocdn.com/u/1024/768/f28a6d1589e187341221784a8ebc5270819697f0.jpg:p",
        "https://lid.zoocdn.com/u/1024/768/f28a6d1589e187341221784a8ebc5270819697f0.jpg",
    ]

    out = normalize_image_urls(urls)

    # Only real photo CDN, and best resolution retained.
    assert out == ["https://lid.zoocdn.com/u/1024/768/f28a6d1589e187341221784a8ebc5270819697f0.jpg"]


def test_normalize_image_urls_filters_otm_logos_and_epc_and_prefers_highest_res():
    urls = [
        "https://media.onthemarket.com/agents/companies/855/220307122012003/logo-190x100.jpg",
        "https://media.onthemarket.com/properties/18584889/1590492994/image-0-480x320.webp",
        "https://media.onthemarket.com/properties/18584889/1590492994/image-0-1024x1024.webp",
        "https://media.onthemarket.com/properties/18584889/1590492994/epc-graph-0-1024x1024.webp",
    ]

    out = normalize_image_urls(urls)

    assert out == [
        "https://media.onthemarket.com/properties/18584889/1590492994/image-0-1024x1024.webp"
    ]
