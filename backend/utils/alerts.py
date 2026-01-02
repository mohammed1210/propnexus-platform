"""
Alert utilities for notifying about anomalous scraper behavior.

Supports:
- Slack webhook notifications
- Email notifications via Resend
"""

import os
import logging
from typing import Optional, Dict, Any
import requests

logger = logging.getLogger(__name__)

# Configuration
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
ALERT_EMAIL_FROM = os.getenv("ALERT_EMAIL_FROM", "alerts@propnexus.com")
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "admin@propnexus.com")

# Anomaly detection thresholds
ANOMALY_THRESHOLD_PCT = float(os.getenv("ANOMALY_THRESHOLD_PCT", "50.0"))  # 50% drop
MIN_EXPECTED_PROPERTIES = int(os.getenv("MIN_EXPECTED_PROPERTIES", "10"))


def send_slack_alert(
    message: str,
    title: Optional[str] = None,
    severity: str = "warning",
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Send alert to Slack via webhook.

    Args:
        message: Alert message text
        title: Optional title for the alert
        severity: Alert severity (info, warning, error, critical)
        metadata: Additional context data

    Returns:
        True if sent successfully, False otherwise
    """
    if not SLACK_WEBHOOK_URL:
        logger.debug("Slack webhook URL not configured, skipping Slack alert")
        return False

    # Map severity to color
    color_map = {
        "info": "#36a64f",  # green
        "warning": "#ff9900",  # orange
        "error": "#ff0000",  # red
        "critical": "#8b0000",  # dark red
    }
    color = color_map.get(severity, "#808080")

    # Build Slack message
    payload = {
        "text": title or "PropNexus Alert",
        "attachments": [
            {
                "color": color,
                "text": message,
                "fields": [
                    {"title": "Severity", "value": severity.upper(), "short": True},
                ],
                "footer": "PropNexus Platform",
                "ts": int(__import__("time").time()),
            }
        ],
    }

    # Add metadata fields
    if metadata:
        for key, value in metadata.items():
            payload["attachments"][0]["fields"].append(
                {
                    "title": key.replace("_", " ").title(),
                    "value": str(value),
                    "short": True,
                }
            )

    try:
        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        logger.info(f"Slack alert sent successfully: {title or message[:50]}")
        return True
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")
        return False


def send_email_alert(
    subject: str,
    message: str,
    severity: str = "warning",
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Send alert via email using Resend.

    Args:
        subject: Email subject line
        message: Email body (plain text or HTML)
        severity: Alert severity (info, warning, error, critical)
        metadata: Additional context data to include

    Returns:
        True if sent successfully, False otherwise
    """
    if not RESEND_API_KEY:
        logger.debug("Resend API key not configured, skipping email alert")
        return False

    # Build HTML email body
    metadata_html = ""
    if metadata:
        metadata_html = "<h3>Details:</h3><ul>"
        for key, value in metadata.items():
            metadata_html += f"<li><strong>{key.replace('_', ' ').title()}:</strong> {value}</li>"
        metadata_html += "</ul>"

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <div style="background-color: #f5f5f5; padding: 20px;">
            <h2 style="color: {"#d9534f" if severity in ("error", "critical") else "#f0ad4e"};">
                PropNexus Alert - {severity.upper()}
            </h2>
            <div style="background-color: white; padding: 15px; border-radius: 5px;">
                <p>{message}</p>
                {metadata_html}
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                This is an automated alert from PropNexus Platform.
            </p>
        </div>
    </body>
    </html>
    """

    payload = {
        "from": ALERT_EMAIL_FROM,
        "to": [ALERT_EMAIL_TO],
        "subject": f"[PropNexus Alert] {subject}",
        "html": html_body,
    }

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        logger.info(f"Email alert sent successfully: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")
        return False


def send_alert(
    message: str,
    title: Optional[str] = None,
    subject: Optional[str] = None,
    severity: str = "warning",
    metadata: Optional[Dict[str, Any]] = None,
    channels: Optional[list[str]] = None,
) -> Dict[str, bool]:
    """Send alert to configured channels.

    Args:
        message: Alert message
        title: Optional title (for Slack)
        subject: Optional subject (for email, defaults to title)
        severity: Alert severity level
        metadata: Additional context
        channels: List of channels to use (default: both Slack and email if configured)

    Returns:
        Dictionary mapping channel name to success status
    """
    if channels is None:
        channels = ["slack", "email"]

    results = {}

    if "slack" in channels:
        results["slack"] = send_slack_alert(message, title, severity, metadata)

    if "email" in channels:
        email_subject = subject or title or message[:50]
        results["email"] = send_email_alert(email_subject, message, severity, metadata)

    return results


def check_scrape_anomaly(
    provider: str,
    location: str,
    properties_count: int,
    recent_avg: Optional[int] = None,
) -> bool:
    """Check if a scrape run shows anomalous behavior and send alerts if so.

    Args:
        provider: Scraper provider name
        location: Location being scraped
        properties_count: Number of properties found in this run
        recent_avg: Average count from recent successful runs (optional)

    Returns:
        True if anomaly detected and alert sent, False otherwise
    """
    # Check for zero results
    if properties_count == 0:
        send_alert(
            message=f"Scrape for {provider} in {location} returned ZERO properties. "
            f"This may indicate a scraper failure or data source issue.",
            title="Zero Properties Alert",
            severity="error",
            metadata={
                "provider": provider,
                "location": location,
                "properties_found": properties_count,
            },
        )
        return True

    # Check for drop below minimum threshold
    if properties_count < MIN_EXPECTED_PROPERTIES:
        send_alert(
            message=f"Scrape for {provider} in {location} returned only {properties_count} properties, "
            f"which is below the minimum threshold of {MIN_EXPECTED_PROPERTIES}.",
            title="Low Property Count Alert",
            severity="warning",
            metadata={
                "provider": provider,
                "location": location,
                "properties_found": properties_count,
                "threshold": MIN_EXPECTED_PROPERTIES,
            },
        )
        return True

    # Check for significant drop compared to recent average
    if recent_avg and recent_avg > 0:
        pct_change = ((properties_count - recent_avg) / recent_avg) * 100
        if abs(pct_change) > ANOMALY_THRESHOLD_PCT and pct_change < 0:
            send_alert(
                message=f"Scrape for {provider} in {location} showed a {abs(pct_change):.1f}% DROP "
                f"compared to recent average. Found {properties_count} vs avg {recent_avg}.",
                title="Significant Drop Alert",
                severity="warning",
                metadata={
                    "provider": provider,
                    "location": location,
                    "properties_found": properties_count,
                    "recent_average": recent_avg,
                    "percent_change": f"{pct_change:.1f}%",
                },
            )
            return True

    return False
