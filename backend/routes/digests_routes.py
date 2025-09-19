# backend/routes/digests_routes.py
import os

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/digests", tags=["digests"])


class TestDigestReq(BaseModel):
    to: str


@router.post("/test")
def send_test_digest(body: TestDigestReq):
    api_key = os.getenv("MAILGUN_API_KEY")
    domain = os.getenv("MAILGUN_DOMAIN")
    from_email = os.getenv("FROM_EMAIL", "PropNexus <no-reply@example.com>")

    if not api_key or not domain:
        raise HTTPException(status_code=500, detail="Missing Mailgun config")

    resp = requests.post(
        f"https://api.mailgun.net/v3/{domain}/messages",
        auth=("api", api_key),
        data={
            "from": from_email,
            "to": body.to,
            "subject": "PropNexus — Test Digest",
            "text": "Your test digest is wired correctly. (Content coming soon.)",
        },
        timeout=10,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Mailgun error: {resp.text}")
    return {"ok": True}
