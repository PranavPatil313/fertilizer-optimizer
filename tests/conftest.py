# tests/conftest.py
import os
import sys

import pytest_asyncio

# Add project root (fertilizer-optimizer/) to sys.path.
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_database():
    """Create the SQLAlchemy schema before integration tests use the database."""
    from src.db.models import Base
    from src.db.session import engine

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    yield

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()
