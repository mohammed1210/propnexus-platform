"""Comprehensive logging for scraper operations.

This module provides structured logging for tracking missing data,
parse failures, and scrape statistics.
"""

import logging
import os
from typing import Dict, Any, Optional
from collections import defaultdict

# Configure logging level
LOG_LEVEL = os.getenv("SCRAPER_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("scraper")


class ScraperStats:
    """Track statistics for scraper runs."""

    def __init__(self, source: str, location: str):
        self.source = source
        self.location = location
        self.total_cards_found = 0
        self.successful_parses = 0
        self.parse_failures = 0
        self.missing_fields: Dict[str, int] = defaultdict(int)
        self.validation_failures = 0
        self.duplicate_ids = 0

    def log_card_found(self):
        """Record a card was found on the page."""
        self.total_cards_found += 1

    def log_parse_success(self):
        """Record successful parse of a card."""
        self.successful_parses += 1

    def log_parse_failure(self, error: str):
        """Record parse failure with error details."""
        self.parse_failures += 1
        logger.warning(f"[{self.source}] Parse failure for {self.location}: {error}")

    def log_missing_field(self, field: str, context: Optional[str] = None):
        """Record a missing or null field."""
        self.missing_fields[field] += 1
        if context:
            logger.debug(f"[{self.source}] Missing {field} in {self.location}: {context}")

    def log_validation_failure(self, reason: str):
        """Record validation failure."""
        self.validation_failures += 1
        logger.debug(f"[{self.source}] Validation failed for {self.location}: {reason}")

    def log_duplicate_id(self, external_id: str):
        """Record duplicate ID."""
        self.duplicate_ids += 1
        logger.debug(f"[{self.source}] Duplicate ID skipped: {external_id}")

    def log_summary(self):
        """Log final statistics."""
        logger.info(
            f"[{self.source}] Scrape summary for '{self.location}': "
            f"found={self.total_cards_found}, "
            f"parsed={self.successful_parses}, "
            f"failed={self.parse_failures}, "
            f"validation_failed={self.validation_failures}, "
            f"duplicates={self.duplicate_ids}"
        )

        if self.missing_fields:
            missing_summary = ", ".join(
                f"{field}={count}" for field, count in sorted(self.missing_fields.items())
            )
            logger.info(f"[{self.source}] Missing fields: {missing_summary}")


def log_scrape_start(source: str, location: str, mode: str):
    """Log the start of a scrape operation."""
    logger.info(f"🔍 Starting {source} scrape for '{location}' (mode={mode})")


def log_page_fetch_error(source: str, page: int, reason: str):
    """Log page fetch failure."""
    logger.warning(f"[{source}] Page {page} fetch failed: {reason}")


def log_retry_attempt(source: str, attempt: int, max_attempts: int, delay: float):
    """Log retry attempt."""
    logger.info(f"[{source}] Retry attempt {attempt}/{max_attempts} after {delay:.1f}s delay")


def log_scraperapi_fallback(source: str, url: str):
    """Log fallback to ScraperAPI."""
    logger.info(f"[{source}] Falling back to ScraperAPI for {url}")


def log_property_validation(source: str, external_id: str, issues: Dict[str, Any]):
    """Log property validation issues."""
    issues_str = ", ".join(f"{k}={v}" for k, v in issues.items())
    logger.warning(f"[{source}] Property {external_id} validation issues: {issues_str}")


def log_image_extraction(source: str, external_id: str, image_count: int):
    """Log image extraction results."""
    if image_count == 0:
        logger.warning(f"[{source}] No images found for property {external_id}")
    else:
        logger.debug(f"[{source}] Extracted {image_count} image(s) for {external_id}")
