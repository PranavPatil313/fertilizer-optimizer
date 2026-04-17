# src/auth/api_key_auth.py

from fastapi import Header, HTTPException
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY", "changeme123")

async def api_key_auth(x_api_key: str = Header(None)):
    """
    Simple API key authentication.
    """
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True
