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


async def daily_scrape() -> None:
    """Example daily scrape job.

    Iterate over a list of target locations, run all scrapers
    (Zoopla, Rightmove, OnTheMarket, SpareRoom) and upsert
    deduplicated results into Supabase.
    Modify the `locations` list or derive it from user saved searches
    to meet your requirements.
    """
    import asyncio

    # Avoid circular imports by importing inside the function
    from scraper.rightmove_scraper import scrape_rightmove_properties
    from scraper.zoopla_scraper import scrape_zoopla_properties
    from scraper.onthemarket_scraper import scrape_onthemarket_properties
    from scraper.spare_room_scraper import scrape_spareroom_properties

    # Feature flags to enable/disable individual scrapers without code changes.
    ENABLE_ZOOPLA = os.getenv("ENABLE_ZOOPLA_SCRAPER", "true").lower() == "true"
    ENABLE_OTM = os.getenv("ENABLE_ONTHEMARKET_SCRAPER", "false").lower() == "true"
    ENABLE_SPAREROOM = os.getenv("ENABLE_SPAREROOM_SCRAPER", "false").lower() == "true"

    # Define the locations you want to scrape daily. You may replace
    # these with user-defined favourites or the most active markets.
    locations = [
        "London",
        "Manchester",
        "Birmingham",
        "Leeds",
        "Glasgow",
        "Bristol",
        "Liverpool",
        "Edinburgh",
        "Cardiff",
        "Nottingham",
    ]

    for location in locations:
        # Build tasks list with feature-flagged scrapers and per-provider limits
        tasks: list[asyncio.Future] = []

        if ENABLE_ZOOPLA:
            tasks.append(scrape_zoopla_properties(location, limit=25))
        else:
            tasks.append(asyncio.sleep(0, result=[]))

        # Rightmove is currently the most reliable source, keep at higher limit
        tasks.append(scrape_rightmove_properties(location, limit=100))

        if ENABLE_OTM:
            tasks.append(scrape_onthemarket_properties(location, limit=25))
        else:
            tasks.append(asyncio.sleep(0, result=[]))

        if ENABLE_SPAREROOM:
            tasks.append(scrape_spareroom_properties(location, limit=25))
        else:
            tasks.append(asyncio.sleep(0, result=[]))

        # Run provider scrapes concurrently for the same location
        zoopla_results, rightmove_results, onthemarket_results, spareroom_results = (
            await asyncio.gather(*tasks)
        )

        zoopla_results = zoopla_results or []
        rightmove_results = rightmove_results or []
        onthemarket_results = onthemarket_results or []
        spareroom_results = spareroom_results or []

        combined = zoopla_results + rightmove_results + onthemarket_results + spareroom_results

        # De-duplicate results by a more stable key (source, external_id)
        seen: set[tuple[str | None, str | None]] = set()
        unique: list[dict] = []
        for prop in combined:
            key = (
                prop.get("source"),
                prop.get("external_id"),
            )
            if key not in seen:
                seen.add(key)
                unique.append(prop)

        # Insert into Supabase
        if unique and supabase:
            # Only keep columns that exist on the Supabase properties table
            allowed_keys = {
                "external_id",
                "longitude",
                "description",
                "title",
                "latitude",
                "price",
                "bathrooms",
                "bedrooms",
                "imageurl",
                "image_urls",  # keep if your table supports this
                "property_type",
                "source",
                "location",
            }

            payload: list[dict] = []
            for prop in unique:
                mapped = dict(prop)

                # The Supabase table uses 'imageurl', not 'image_url'
                if "image_url" in mapped:
                    if mapped.get("image_url") and not mapped.get("imageurl"):
                        mapped["imageurl"] = mapped["image_url"]
                    mapped.pop("image_url", None)

                # If imageurl is still missing but image_urls is present,
                # default to the first image for card display.
                if not mapped.get("imageurl") and mapped.get("image_urls"):
                    try:
                        urls = mapped["image_urls"] or []
                        if isinstance(urls, list) and urls:
                            mapped["imageurl"] = urls[0]
                    except Exception:
                        pass

                # Drop any fields that are not present in the table schema
                mapped = {k: v for k, v in mapped.items() if k in allowed_keys}

                payload.append(mapped)

            # Insert new rows; if some conflict with existing unique constraints,
            # log and continue so scrapes don't fail hard.
            try:
                supabase.table("properties").insert(payload).execute()
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️ Supabase insert error (likely duplicates, continuing): {exc}")


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
