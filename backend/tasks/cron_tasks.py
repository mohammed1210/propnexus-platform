# backend/tasks/cron_tasks.py

"""
Scheduled task stubs for the PropNexus backend.

This module defines functions that can be executed on a cron schedule
via your hosting provider (e.g. Railway or Render). They illustrate how
you might trigger regular scrapes and send digest emails without
blocking the main API process. You can customise the location list,
timing and email contents based on your needs.

These functions are intentionally synchronous to keep implementation
simple. If your hosting supports async tasks or background jobs you
may wish to adapt them accordingly.
"""

import os

from supabase import create_client

# Import scrapers lazily inside functions to avoid heavy imports when
# this module is imported but tasks are not run.

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def daily_scrape() -> None:
    """Example daily scrape job.

    Iterate over a list of target locations, run both Zoopla and
    Rightmove scrapers and upsert deduplicated results into Supabase.
    Modify the `locations` list or derive it from user saved searches
    to meet your requirements.
    """
    # Avoid circular imports by importing inside the function
    from scraper.rightmove_scraper import scrape_rightmove_properties
    from scraper.zoopla_scraper import scrape_zoopla_properties

    # Define the locations you want to scrape daily. You may replace
    # these with user-defined favourites or the most active markets.
    locations = ["London", "Manchester"]

    for location in locations:
        zoopla_results = scrape_zoopla_properties(location) or []
        rightmove_results = scrape_rightmove_properties(location) or []
        combined = zoopla_results + rightmove_results
        # De-duplicate results by a simple key (title, price, location)
        seen: set[tuple[str, float, str]] = set()
        unique: list[dict] = []
        for prop in combined:
            key = (
                prop.get("title"),
                prop.get("price"),
                prop.get("location"),
            )
            if key not in seen:
                seen.add(key)
                unique.append(prop)
        # Upsert into Supabase
        if unique and supabase:
            supabase.table("properties").upsert(unique).execute()


def send_daily_digest() -> None:
    """Example daily email digest job.

    Fetches recent properties and sends a summary email to subscribers.
    You should implement subscriber management and email templating
    according to your needs. For actual email sending, call the
    `/send-email` endpoint or use the Mailgun API directly.
    """
    # Placeholder: implement logic to fetch new properties, build an
    # email body and call the email sending route. At this stage we
    # simply return without doing anything.
    return None
