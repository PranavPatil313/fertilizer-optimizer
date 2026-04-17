# src/main.py

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.status import HTTP_403_FORBIDDEN

# Load .env variables
load_dotenv()

API_KEY = os.getenv("API_KEY")
RATE_LIMIT = os.getenv("RATE_LIMIT", "5/minute")

app = FastAPI(title="Fertilizer Optimizer")

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
