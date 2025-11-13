"""Retry utilities for scraper operations with exponential backoff."""

import asyncio
import logging
import os
from typing import Any, Callable, TypeVar, Optional
from functools import wraps

logger = logging.getLogger("scraper.retry")

# Configuration from environment
MAX_RETRIES = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
BASE_DELAY = float(os.getenv("SCRAPER_RETRY_BASE_DELAY", "2.0"))  # seconds
MAX_DELAY = float(os.getenv("SCRAPER_RETRY_MAX_DELAY", "30.0"))  # seconds
BACKOFF_FACTOR = float(os.getenv("SCRAPER_RETRY_BACKOFF_FACTOR", "2.0"))

T = TypeVar('T')


def calculate_delay(attempt: int, base_delay: float = BASE_DELAY) -> float:
    """Calculate exponential backoff delay for retry attempt.
    
    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        
    Returns:
        Delay in seconds, capped at MAX_DELAY
    """
    delay = base_delay * (BACKOFF_FACTOR ** attempt)
    return min(delay, MAX_DELAY)


async def retry_async(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
    **kwargs: Any
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
                logger.error(
                    f"All {max_retries} retries exhausted for {func.__name__}: {e}"
                )
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
    max_retries: int = MAX_RETRIES,
    base_delay: float = BASE_DELAY,
    exceptions: tuple = (Exception,)
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
                **kwargs
            )
        return wrapper
    return decorator
