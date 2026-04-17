# src/auth.py
import os
from fastapi import Header, HTTPException

API_KEY = os.getenv("API_KEY", "supersecretkey123")
ENV = os.getenv("ENV", "dev")

def api_key_auth(x_api_key: str = Header(None)):
    if ENV == "dev":
        return True  # Skip check in development mode
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True