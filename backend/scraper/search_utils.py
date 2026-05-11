"""
Helpers for building portal-search URLs that surface
⚡ lowest-price, ⚡ oldest-listing and ⚡ recently-reduced stock
so we can capture “hidden” bargains without deep-paging.
"""

from typing import Any
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
    for _, sort_type in _RIGHTMOVE_SORT_PARAMS.items():
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


def build_rightmove_top_deal_search_urls(
    region_code: str,
    base_url: str = "https://www.rightmove.co.uk/property-for-sale/find.html",
    results_per_page: int = 24,
) -> list[dict[str, Any]]:
    """Return Rightmove search URLs with ranking metadata attached."""
    urls: list[dict[str, Any]] = []
    for sort_label, sort_type in _RIGHTMOVE_SORT_PARAMS.items():
        query = urlencode(
            {
                "locationIdentifier": region_code,
                "index": 0,
                "sortType": sort_type,
                "propertyTypes": "",
                "includeSSTC": "false",
                "mustHave": "",
                "dontShow": "",
                "furnishTypes": "",
                "maxDaysSinceAdded": "",
                "keywords": "",
                "pageSize": results_per_page,
            },
            safe="^",
        )
        urls.append(
            {
                "url": f"{base_url}?{query}",
                "metadata": {
                    "strategy": "top_deal",
                    "portal": "rightmove",
                    "sort_label": "recently_reduced" if sort_label == "reduced" else sort_label,
                    "sort_type": sort_type,
                    "page": 1,
                },
            }
        )
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
    max_pages: int = 1,
) -> list[str]:
    """
    Zoopla build is path-based (`/for-sale/property/<city>/?q=<city>&results_sort=age`)
    """
    urls: list[str] = []
    effective_max_pages = max(1, int(max_pages or 1))

    for _, sort_flag in _ZOOPLA_SORT_PARAMS.items():
        for page in range(1, effective_max_pages + 1):
            query = urlencode(
                {
                    "q": place_name,
                    "results_sort": sort_flag,
                    "pn": page,
                    "view_type": "list",
                    "include_rented": "false",
                }
            )
            urls.append(f"{base_url}/{place_name}/?{query}")
    return urls


def build_zoopla_top_deal_search_urls(
    place_name: str,
    base_url: str = "https://www.zoopla.co.uk/for-sale/property",
    results_per_page: int = 25,
    max_pages: int = 1,
) -> list[dict[str, Any]]:
    urls: list[dict[str, Any]] = []
    effective_max_pages = max(1, int(max_pages or 1))
    for sort_label, sort_flag in _ZOOPLA_SORT_PARAMS.items():
        for page in range(1, effective_max_pages + 1):
            query = urlencode(
                {
                    "q": place_name,
                    "results_sort": sort_flag,
                    "pn": page,
                    "view_type": "list",
                    "include_rented": "false",
                    "page_size": results_per_page,
                }
            )
            urls.append(
                {
                    "url": f"{base_url}/{place_name}/?{query}",
                    "metadata": {
                        "strategy": "top_deal",
                        "portal": "zoopla",
                        "sort_label": "recently_reduced" if sort_label == "reduced" else sort_label,
                        "sort_type": sort_flag,
                        "page": page,
                    },
                }
            )
    return urls


def build_onthemarket_top_deal_search_urls(
    place_name: str,
    base_url: str = "https://www.onthemarket.com/for-sale/property",
    max_pages: int = 1,
) -> list[dict[str, Any]]:
    sort_params = {
        "lowest_price": "price-asc",
        "oldest": "oldest-first",
        "recently_reduced": "reduced",
    }
    slug = str(place_name or "").strip().lower().replace(" ", "-")
    urls: list[dict[str, Any]] = []
    for sort_label, sort_flag in sort_params.items():
        for page in range(1, max(1, int(max_pages or 1)) + 1):
            query = urlencode({"sort-field": sort_flag, "page": page})
            urls.append(
                {
                    "url": f"{base_url}/{slug}/?{query}",
                    "metadata": {
                        "strategy": "top_deal",
                        "portal": "onthemarket",
                        "sort_label": sort_label,
                        "sort_type": sort_flag,
                        "page": page,
                    },
                }
            )
    return urls
