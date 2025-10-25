# backend/utils/emailer.py
import os

import requests

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM_EMAIL", "PropNexus <noreply@example.com>")


def send_magic_email(to_email: str, magic_url: str):
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY missing")
    html = f"""
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial">
      <h2>Sign in to PropNexus</h2>
      <p>Click the button below to access your account.</p>
      <p><a href="{magic_url}" style="display:inline-block;padding:12px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none">Open PropNexus</a></p>
      <p>This link expires soon. If you didn’t request it, you can ignore this email.</p>
    </div>
    """
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json={
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": "Your PropNexus Magic Link",
            "html": html,
        },
        timeout=20,
    )
    r.raise_for_status()
