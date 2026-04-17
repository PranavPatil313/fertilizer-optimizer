# src/api/deps.py
import os
from fastapi import Header, HTTPException, status, Depends
from jose import JWTError, jwt
from sqlalchemy import select

from src.db.session import AsyncSessionLocal
from src.db.models import User

SECRET = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET", "super-secret-key"))
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

def get_token_from_header(authorization: str | None = Header(None)):
    """
    Expect Authorization: Bearer <token>
    """
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
    return parts[1]

async def get_current_user_token(token: str = Depends(get_token_from_header)):
    # verify / decode token
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except JWTError as e:
        if "expired" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # Expected claims: "user_id" or "sub"
    user_id = payload.get("user_id") or payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_id missing in token")
    # convert numeric strings to int when possible
    try:
        user_id = int(user_id)
    except Exception:
        pass
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        if not bool(user.is_active):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return {
        "user_id": user.id,
        "email": user.email,
        "role": user.role or "user",
        "payload": payload,
    }


async def require_admin(current_user: dict = Depends(get_current_user_token)):
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user
