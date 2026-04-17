# src/api/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import EmailStr
from src.api.schemas_auth import SignupRequest, LoginRequest, TokenResponse, UserInfo
from src.auth.utils import hash_password, verify_password
from src.auth.jwt import create_access_token
from src.db.session import AsyncSessionLocal
from src.db.models import User
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import os

router = APIRouter(prefix="/auth", tags=["auth"])
ADMIN_EMAILS = {email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()}


@router.post("/signup", status_code=201)
async def signup(payload: SignupRequest):
    """
    Create a new user with hashed password.
    """
    try:
        async with AsyncSessionLocal() as session:
            session: AsyncSession = session  # type: AsyncSession
            # check existing user
            q = await session.execute(select(User).where(User.email == payload.email))
            existing = q.scalars().first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already registered")

            # create user
            role = "admin" if payload.email.lower() in ADMIN_EMAILS else "user"
            user = User(email=payload.email, hashed_password=hash_password(payload.password), role=role)
            session.add(user)
            try:
                await session.commit()
                await session.refresh(user)
            except IntegrityError:
                await session.rollback()
                raise HTTPException(status_code=400, detail="Could not create user")
            return {"message": "user created", "user_id": user.id}
    except HTTPException:
        raise
    except Exception as e:
        # Database connection or other errors
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service temporarily unavailable: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """
    Authenticate user and return JWT token.
    """
    try:
        async with AsyncSessionLocal() as session:
            session: AsyncSession = session  # type: AsyncSession
            q = await session.execute(select(User).where(User.email == payload.email))
            user = q.scalars().first()
            if not user or not verify_password(payload.password, user.hashed_password):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
            expires_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
            token = create_access_token(
                {"sub": str(user.email), "user_id": user.id, "role": user.role},
                expires_delta=expires_minutes,
            )
            return TokenResponse(
                access_token=token,
                expires_in_minutes=expires_minutes,
                user=UserInfo(id=user.id, email=user.email, role=user.role or "user"),
            )
    except HTTPException:
        raise
    except Exception as e:
        # Database connection or other errors
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service temporarily unavailable: {str(e)}"
        )