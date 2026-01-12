from __future__ import annotations

import os
from typing import Iterable

import httpx

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM")  # e.g. no-reply@propnexus.app (verified)
RESEND_FROM_FALLBACK = os.getenv("RESEND_FROM_FALLBACK", "onboarding@resend.dev")


async def send_email(
    to: str | Iterable[str],
    subject: str,
    html: str,
    *,
    from_email: str | None = None,
) -> None:
    """
    Minimal Resend email sender.
    Falls back to onboarding@resend.dev if a verified 'from' is not provided.
    Silently no-ops if RESEND_API_KEY is missing (so dev envs don't crash).
    """
    if not RESEND_API_KEY:
        # No email sending in environments without a key
        return

    recipients = [to] if isinstance(to, str) else list(to)
    sender = from_email or RESEND_FROM or RESEND_FROM_FALLBACK

    payload = {
        "from": f"PropNexus <{sender}>",
        "to": recipients,
        "subject": subject,
        "html": html,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json=payload,
        )
        r.raise_for_status()


async def send_magic_email(to: str | Iterable[str], magic_url: str) -> None:
    subject = "Your PropNexus magic link"
    url = (magic_url or "").strip()
    if not url:
        return

    html = (
        "<div style='font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'>"
        "<h2>Sign in to PropNexus</h2>"
        "<p>Use this magic link to sign in:</p>"
        f"<p><a href='{url}' style='display:inline-block;padding:10px 14px;"
        "background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;'>"
        "Sign in</a></p>"
        f"<p style='word-break:break-all;color:#6b7280;font-size:12px'>{url}</p>"
        "<p style='color:#6b7280;font-size:12px'>If you didn't request this, you can ignore this email.</p>"
        "</div>"
    )

    await send_email(to=to, subject=subject, html=html)
