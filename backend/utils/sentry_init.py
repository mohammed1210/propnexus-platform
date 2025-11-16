"""
Sentry initialization for backend (FastAPI).

Only initializes Sentry in production when DSN is configured.
In development and test environments, Sentry is disabled to prevent false events.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Only enable Sentry in production with DSN configured
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("RAILWAY_ENVIRONMENT", "development"))
IS_PRODUCTION = ENVIRONMENT.lower() in ("production", "prod")


def init_sentry():
    """Initialize Sentry for error tracking and performance monitoring."""
    if not SENTRY_DSN:
        logger.info("Sentry DSN not configured, skipping Sentry initialization")
        return False
    
    if not IS_PRODUCTION:
        logger.info(f"Sentry disabled in {ENVIRONMENT} environment")
        return False
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        
        # Configure Sentry
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            # Performance monitoring sample rate (10% of requests)
            traces_sample_rate=0.1,
            # Capture 10% of errors for quota management
            sample_rate=0.1,
            # PII filtering - do not send sensitive data
            send_default_pii=False,
            # Integrations
            integrations=[
                FastApiIntegration(),
                StarletteIntegration(),
                LoggingIntegration(
                    level=logging.INFO,  # Capture INFO and above
                    event_level=logging.ERROR,  # Send ERROR and above to Sentry
                ),
            ],
            # Release tracking (from git commit or Railway)
            release=os.getenv("RAILWAY_GIT_COMMIT_SHA", None),
            # Ignore specific errors
            ignore_errors=[
                KeyboardInterrupt,
                SystemExit,
            ],
            # Filter out sensitive paths
            before_send=_before_send,
        )
        
        logger.info(f"Sentry initialized successfully for {ENVIRONMENT} environment")
        return True
        
    except ImportError:
        logger.warning("sentry-sdk not installed, skipping Sentry initialization")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")
        return False


def _before_send(event, hint):
    """Filter or modify events before sending to Sentry.
    
    This hook allows us to:
    - Strip sensitive data from error contexts
    - Filter out specific error types
    - Add custom tags or context
    """
    # Remove any query parameters that might contain sensitive data
    if "request" in event and "query_string" in event["request"]:
        # Remove common sensitive params
        sensitive_params = ["api_key", "token", "password", "secret"]
        query = event["request"].get("query_string", "")
        for param in sensitive_params:
            if param in query.lower():
                event["request"]["query_string"] = "[FILTERED]"
                break
    
    # Strip email addresses from error messages
    if "message" in event:
        import re
        event["message"] = re.sub(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            '[EMAIL]',
            event["message"]
        )
    
    return event


def capture_exception(error: Exception, **context):
    """Capture an exception and send to Sentry with additional context.
    
    Args:
        error: The exception to capture
        **context: Additional context to attach (e.g., user_id, request_id)
    """
    if not IS_PRODUCTION or not SENTRY_DSN:
        logger.debug(f"Skipping Sentry capture (not production): {error}")
        return
    
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            # Add custom context
            for key, value in context.items():
                scope.set_context(key, {"value": value})
            
            sentry_sdk.capture_exception(error)
    except Exception as e:
        logger.error(f"Failed to capture exception in Sentry: {e}")


def capture_message(message: str, level: str = "info", **context):
    """Capture a message and send to Sentry.
    
    Args:
        message: Message to capture
        level: Severity level (debug, info, warning, error, fatal)
        **context: Additional context
    """
    if not IS_PRODUCTION or not SENTRY_DSN:
        return
    
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_context(key, {"value": value})
            
            sentry_sdk.capture_message(message, level=level)
    except Exception as e:
        logger.error(f"Failed to capture message in Sentry: {e}")
