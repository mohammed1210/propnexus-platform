from bs4 import BeautifulSoup

from backend.scraper.spare_room_scraper import _extract_external_id_and_url, _extract_images


def test_spareroom_extracts_listing_url_even_with_data_id_and_filters_placeholders() -> None:
    html = """
    <li class="listing-result" data-advert-id="999999">
      <a href="/flatshare/flatshare_detail.pl?flatshare_id=1234567">View</a>
      <img src="https://www.spareroom.co.uk/img/profilepic_unisex.gif" />
      <img src="//images.example.com/photo1.jpg" />
    </li>
    """
    card = BeautifulSoup(html, "html.parser").select_one("li")
    assert card is not None

    external_id, listing_url = _extract_external_id_and_url(card)
    assert external_id == "sr-999999"
    assert (
        listing_url
        == "https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=1234567"
    )

    images = _extract_images(card)
    assert images
    assert all("profilepic" not in u.lower() for u in images)
    assert images[0].startswith("https://")
