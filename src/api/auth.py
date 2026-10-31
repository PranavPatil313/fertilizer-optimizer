# src/api/auth.py
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import EmailStr
from src.api.schemas_auth import SignupRequest, LoginRequest, TokenResponse, UserInfo, ForgotPasswordRequest, ResetPasswordRequest
from src.auth.utils import hash_password, verify_password
from src.auth.jwt import create_access_token
from src.db.session import AsyncSessionLocal
from src.db.models import User
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import os
import logging
from jose import jwt, JWTError

router = APIRouter(prefix="/auth", tags=["auth"])
ADMIN_EMAILS = {email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()}
SECRET = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
logger = logging.getLogger(__name__)

def send_reset_email_stub(email: str, token: str):
    """
    Stub for sending a password reset email.
    In production, integrate with SendGrid, AWS SES, or Mailgun.
    """
    reset_link = f"http://localhost:5173/reset-password?token={token}"
    logger.info(f"\n--- EMAIL STUB ---\nTo: {email}\nSubject: Password Reset Request\nClick here to reset your password: {reset_link}\n------------------\n")


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


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    try:
        async with AsyncSessionLocal() as session:
            session: AsyncSession = session
            q = await session.execute(select(User).where(User.email == payload.email))
            user = q.scalars().first()
            
            if user:
                # Create a short-lived token (15 mins)
                token = create_access_token(
                    {"sub": str(user.email), "user_id": user.id, "type": "reset"},
                    expires_delta=15
                )
                background_tasks.add_task(send_reset_email_stub, user.email, token)
            
            # Always return 200 to prevent user email enumeration
            return {"message": "If that email is registered, a password reset link has been sent."}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process password reset.")

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    try:
        if not SECRET or len(SECRET) < 32:
            raise HTTPException(status_code=503, detail="JWT secret is not configured securely")
        decoded = jwt.decode(payload.token, SECRET, algorithms=[ALGORITHM])
        if decoded.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
            
        user_id = decoded.get("user_id")
        async with AsyncSessionLocal() as session:
            session: AsyncSession = session
            user = await session.get(User, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user.hashed_password = hash_password(payload.new_password)
            await session.commit()
            return {"message": "Password successfully reset. You can now log in."}
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")


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