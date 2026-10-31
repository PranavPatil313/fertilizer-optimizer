# src/auth/api_key_auth.py

import os

from dotenv import load_dotenv
from fastapi import Header, HTTPException, status

load_dotenv()


async def api_key_auth(x_api_key: str | None = Header(default=None)):
    """Validate the configured API key without using an insecure fallback."""
    expected_key = os.getenv("API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API key authentication is not configured",
        )
    if not x_api_key or x_api_key != expected_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return True
