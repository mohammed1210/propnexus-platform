# backend/utils/jwt_utils.py
import datetime
import os

from jose import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME")
ALGO = "HS256"
TTL_MIN = int(os.getenv("MAGIC_LINK_TTL_MINUTES", "20"))


def make_magic_token(email: str, tier: str = "pro") -> str:
    now = datetime.datetime.utcnow()
    payload = {
        "sub": email,
        "tier": tier,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(minutes=TTL_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGO)
