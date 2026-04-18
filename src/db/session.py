# src/db/session.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import re

def get_async_database_url():
    """
    Get database URL and ensure it uses asyncpg driver for async operations.
    Railway provides DATABASE_URL in format: postgresql://user:pass@host:port/db
    We need to convert it to: postgresql+asyncpg://user:pass@host:port/db
    
    In production (Railway), DATABASE_URL must be set.
    For local development without PostgreSQL, falls back to SQLite.
    """
    url = os.getenv("DATABASE_URL")
    
    if not url:
        # No DATABASE_URL set - use SQLite for local development
        print("WARNING: DATABASE_URL not set. Using SQLite for local development.")
        print("   For production (Railway), ensure PostgreSQL is attached and DATABASE_URL is set.")
        return "sqlite+aiosqlite:///./fertilizer.db"
    
    # Convert postgresql:// to postgresql+asyncpg:// if no async driver specified
    if url.startswith("postgresql://") and "+asyncpg" not in url and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        print(f"Converted DATABASE_URL to async format: {url[:50]}...")
    
    return url

DATABASE_URL = get_async_database_url()

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    connect_args={
        "timeout": 10,  # 10 second connection timeout for asyncpg
    }
)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)
