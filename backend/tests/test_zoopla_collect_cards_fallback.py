from bs4 import BeautifulSoup

from backend.scraper.zoopla_scraper import _collect_cards


def test_collect_cards_fallback_from_detail_links() -> None:
    html = """
    <html><body>
      <div class='something'>
        <article data-testid='search-result-card'>
          <a href='/for-sale/details/12345678/'>Listing</a>
        </article>
      </div>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    cards = _collect_cards(soup)
    assert len(cards) >= 1


def test_collect_cards_fallback_container_is_article_or_li() -> None:
    html = """
    <html><body>
      <ul>
        <li>
          <div>
            <a href='https://www.zoopla.co.uk/for-sale/details/999/'>Listing</a>
          </div>
        </li>
      </ul>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    cards = _collect_cards(soup)
    assert len(cards) >= 1
