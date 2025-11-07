# backend/utils/supabase_jwt.py
"""
Utility functions for verifying Supabase JWT tokens.
"""
import os
from typing import Optional
from jose import jwt, JWTError


def verify_supabase_token(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT token and return the payload.
    
    Args:
        token: The JWT token string (without 'Bearer ' prefix)
    
    Returns:
        The token payload dict if valid, None otherwise
    """
    supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
    
    if not supabase_jwt_secret:
        # If no JWT secret is configured, try to use the anon key
        # In Supabase, the JWT secret is typically derived from the service role key
        # For development, we might need to use the service role key
        supabase_jwt_secret = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_jwt_secret:
        return None
    
    try:
        # Decode the JWT token
        # Supabase uses HS256 algorithm
        payload = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase tokens don't always have aud
        )
        return payload
    except JWTError:
        return None


def extract_bearer_token(authorization_header: Optional[str]) -> Optional[str]:
    """
    Extract the token from an Authorization header.
    
    Args:
        authorization_header: The full Authorization header value
    
    Returns:
        The token string if valid Bearer format, None otherwise
    """
    if not authorization_header:
        return None
    
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]
