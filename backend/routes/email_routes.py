# backend/routes/email_routes.py

"""
Minimal email sending route using Mailgun.

This module provides an endpoint for sending plain text emails via the
Mailgun API. It is intended for notifications such as scrape-complete
alerts or periodic digests. To enable this, set the following
environment variables in your deployment:

* `MAILGUN_API_KEY` – your Mailgun API key
* `MAILGUN_DOMAIN`  – the domain configured on Mailgun (e.g. mg.example.com)
* `FROM_EMAIL`      – the sender address shown in outgoing emails

If these variables are missing the endpoint will return a 500 error.

You can call this endpoint from the frontend or from scheduled
tasks. It expects a JSON body with `to`, `subject` and `text` fields.
"""

import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Environment configuration
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
FROM_EMAIL = os.getenv("FROM_EMAIL") or "PropNexus <no-reply@example.com>"


class EmailRequest(BaseModel):
    """Schema for email send requests."""

    to: str
    subject: str
    text: str


@router.post("/send-email")
async def send_email(req: EmailRequest) -> dict[str, str]:
    """Send an email through Mailgun.

    Args:
        req (EmailRequest): The recipient, subject and body of the email.

    Returns:
        dict[str, str]: A simple status message on success.

    Raises:
        HTTPException: If Mailgun is not configured or the API call fails.
    """
    if not MAILGUN_API_KEY or not MAILGUN_DOMAIN:
        raise HTTPException(status_code=500, detail="Mailgun not configured")

    url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
    auth = ("api", MAILGUN_API_KEY)
    data = {
        "from": FROM_EMAIL,
        "to": req.to,
        "subject": req.subject,
        "text": req.text,
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, auth=auth, data=data)
            # Mailgun returns status 200 on success
            if response.status_code >= 400:
                raise Exception(response.text)
        return {"status": "sent"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
