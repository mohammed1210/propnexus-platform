"""
Helpers for building portal-search URLs that surface
⚡ lowest-price, ⚡ oldest-listing and ⚡ recently-reduced stock
so we can capture “hidden” bargains without deep-paging.
"""

from urllib.parse import urlencode

# ========= Rightmove =========
# Rightmove uses sortType integers in the query string.
# 6 = Lowest price, 1 = Oldest first, 33 = Recently reduced
_RIGHTMOVE_SORT_PARAMS = {
    "lowest_price": "6",
    "oldest": "1",
    "reduced": "33",
}


def build_rightmove_search_urls(
    region_code: str,
    base_url: str = "https://www.rightmove.co.uk/property-for-sale/find.html",
    results_per_page: int = 24,
) -> list[str]:
    """
    Returns three search URLs for one geographic region:
      • lowest price
      • oldest listing
      • recently reduced
    We only hit page-1 of each – ~24 results apiece.
    """
    urls: list[str] = []
    for sort_name, sort_type in _RIGHTMOVE_SORT_PARAMS.items():
        query = urlencode(
            {
                "locationIdentifier": region_code,  # e.g. "REGION^87490" (Liverpool)
                "index": 0,
                "sortType": sort_type,
                "propertyTypes": "",  # all types
                "includeSSTC": "false",
                "mustHave": "",
                "dontShow": "",
                "furnishTypes": "",
                "maxDaysSinceAdded": "",  # allow old stock
                "keywords": "",
                "pageSize": results_per_page,
            },
            safe="^",  # keep REGION^ in the identifier
        )
        urls.append(f"{base_url}?{query}")
    return urls


# ========= Zoopla =========
# Equivalent sort flags: priceLow, age, priceReduced
_ZOOPLA_SORT_PARAMS = {
    "lowest_price": "priceLow",
    "oldest": "age",
    "reduced": "priceReduced",
}


def build_zoopla_search_urls(
    place_name: str,
    base_url: str = "https://www.zoopla.co.uk/for-sale/property",
    results_per_page: int = 25,
) -> list[str]:
    """
    Zoopla build is path-based (`/for-sale/property/<city>/?q=<city>&results_sort=age`)
    """
    urls: list[str] = []
    for _, sort_flag in _ZOOPLA_SORT_PARAMS.items():
        query = urlencode(
            {
                "q": place_name,
                "results_sort": sort_flag,
                "pn": 1,  # first page only
                "view_type": "list",
                "include_rented": "false",
            }
        )
        urls.append(f"{base_url}/{place_name}/?{query}")
    return urls
