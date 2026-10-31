# src/auth/jwt.py

import os
from datetime import datetime, timedelta

from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def _require_secret() -> str:
    if not SECRET_KEY or len(SECRET_KEY) < 32:
        raise RuntimeError("Set SECRET_KEY to a random value of at least 32 characters.")
    return SECRET_KEY


def create_access_token(data: dict, expires_delta: int = None):
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta or ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _require_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str):
    """Decode and validate a JWT token; return None if configuration or token is invalid."""
    try:
        return jwt.decode(token, _require_secret(), algorithms=[ALGORITHM])
    except (JWTError, RuntimeError):
        return None
