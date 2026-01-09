"""Retry utilities for scraper operations with exponential backoff."""

import asyncio
import logging
import os
import random
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar

import aiohttp

logger = logging.getLogger("scraper.retry")

# Configuration from environment
MAX_RETRIES = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
BASE_DELAY = float(os.getenv("SCRAPER_RETRY_BASE_DELAY", "2.0"))  # seconds
MAX_DELAY = float(os.getenv("SCRAPER_RETRY_MAX_DELAY", "30.0"))  # seconds
BACKOFF_FACTOR = float(os.getenv("SCRAPER_RETRY_BACKOFF_FACTOR", "2.0"))
JITTER_ENABLED = os.getenv("SCRAPER_RETRY_JITTER", "true").lower() in ("true", "1", "yes")

T = TypeVar("T")


def calculate_delay(
    attempt: int, base_delay: float = BASE_DELAY, jitter: bool = JITTER_ENABLED
) -> float:
    """Calculate exponential backoff delay for retry attempt.

    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        jitter: Whether to add random jitter

    Returns:
        Delay in seconds, capped at MAX_DELAY
    """
    delay = base_delay * (BACKOFF_FACTOR**attempt)
    delay = min(delay, MAX_DELAY)

    # Add random jitter to prevent thundering herd
    if jitter:
        delay *= 0.5 + random.random()

    return delay


async def retry_async(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
    **kwargs: Any,
) -> Any:
    """Retry an async function with exponential backoff.

    Args:
        func: Async function to retry
        *args: Positional arguments for func
        max_retries: Maximum number of retry attempts
        base_delay: Base delay for exponential backoff
        exceptions: Tuple of exception types to catch and retry
        on_retry: Optional callback called on each retry (attempt, exception)
        **kwargs: Keyword arguments for func

    Returns:
        Result of func if successful

    Raises:
        Last exception if all retries exhausted
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exception = e

            if attempt >= max_retries:
                logger.error(f"All {max_retries} retries exhausted for {func.__name__}: {e}")
                raise

            delay = calculate_delay(attempt, base_delay)

            if on_retry:
                on_retry(attempt + 1, e)

            logger.warning(
                f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                f"after {delay:.1f}s delay (error: {e})"
            )

            await asyncio.sleep(delay)

    # Should not reach here, but for type safety
    if last_exception:
        raise last_exception
    raise RuntimeError("Unexpected retry loop termination")


def retry_async_decorator(
    max_retries: int = MAX_RETRIES, base_delay: float = BASE_DELAY, exceptions: tuple = (Exception,)
):
    """Decorator for retrying async functions with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay for exponential backoff
        exceptions: Tuple of exception types to catch and retry

    Example:
        @retry_async_decorator(max_retries=3, base_delay=1.0)
        async def fetch_data():
            # ... async operation that might fail
            pass
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            return await retry_async(
                func,
                *args,
                max_retries=max_retries,
                base_delay=base_delay,
                exceptions=exceptions,
                **kwargs,
            )

        return wrapper

    return decorator


async def fetch_with_retry(
    session: aiohttp.ClientSession,
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Any] = None,
    json: Optional[Dict[str, Any]] = None,
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
    timeout: int = 30,
) -> aiohttp.ClientResponse:
    """Fetch URL with exponential backoff retry logic.

    Retries on:
    - Network errors (ConnectionError, TimeoutError)
    - HTTP 5xx errors (server errors)
    - HTTP 429 (rate limit)

    Does NOT retry on:
    - HTTP 4xx errors (except 429)
    - Successful responses (2xx, 3xx)

    Args:
        session: aiohttp ClientSession
        url: URL to fetch
        method: HTTP method (GET, POST, etc.)
        headers: Optional HTTP headers
        params: Optional query parameters
        data: Optional form data
        json: Optional JSON body
        max_retries: Maximum number of retry attempts
        base_delay: Base delay for exponential backoff
        timeout: Request timeout in seconds

    Returns:
        aiohttp ClientResponse object

    Raises:
        aiohttp.ClientError: After all retries exhausted
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            async with session.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                data=data,
                json=json,
                timeout=aiohttp.ClientTimeout(total=timeout),
            ) as response:
                # Fail fast on client errors (except 429)
                if 400 <= response.status < 500 and response.status != 429:
                    logger.warning(f"Client error {response.status} for {url}, not retrying")
                    response.raise_for_status()

                # Retry on 429 or 5xx
                if response.status == 429 or response.status >= 500:
                    if attempt >= max_retries:
                        logger.error(f"Max retries reached for {url}, status {response.status}")
                        response.raise_for_status()

                    delay = calculate_delay(attempt, base_delay)
                    logger.warning(
                        f"HTTP {response.status} for {url}, retrying {attempt + 1}/{max_retries} "
                        f"after {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
                    continue

                # Success case
                return response

        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            last_exception = e

            if attempt >= max_retries:
                logger.error(f"All retries exhausted for {url}: {e}")
                raise

            delay = calculate_delay(attempt, base_delay)
            logger.warning(
                f"Network error for {url}, retrying {attempt + 1}/{max_retries} "
                f"after {delay:.1f}s: {e}"
            )
            await asyncio.sleep(delay)

    # Should not reach here, but for safety
    if last_exception:
        raise last_exception
    raise RuntimeError(f"Unexpected retry loop termination for {url}")
