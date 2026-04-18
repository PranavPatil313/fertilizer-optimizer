#alembic/env.py

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------
# Add project root to PYTHONPATH
# ---------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ---------------------------------------------------------
# Alembic Config
# ---------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------
# Import SQLAlchemy Base from your project
# ---------------------------------------------------------
# Your models are located here: src/db/models.py
from src.db.models import Base

# Alembic needs metadata to detect schema changes
target_metadata = Base.metadata

# ---------------------------------------------------------
# Database URL configuration
# ---------------------------------------------------------
def get_sync_database_url():
    """
    Get a synchronous database URL for Alembic migrations.
    Uses DATABASE_URL environment variable, falling back to default.
    Converts async drivers (psycopg, asyncpg) to sync driver (psycopg2).
    """
    import re
    # Get DATABASE_URL from environment or use default from session.py
    default_url = "postgresql+asyncpg://fertilizer_user:fertilizer_password@postgres:5432/fertilizer_db"
    url = os.getenv("DATABASE_URL", default_url)
    
    # Convert async driver to sync driver (psycopg2)
    # Replace postgresql+psycopg with postgresql+psycopg2
    url = re.sub(r'postgresql\+psycopg:', 'postgresql+psycopg2:', url)
    # Replace postgresql+asyncpg with postgresql+psycopg2
    url = re.sub(r'postgresql\+asyncpg:', 'postgresql+psycopg2:', url)
    # If no driver specified (postgresql://), keep as is (defaults to psycopg2)
    return url

# Override sqlalchemy.url in config with sync URL
sync_url = get_sync_database_url()
config.set_main_option('sqlalchemy.url', sync_url)


# ---------------------------------------------------------
# Offline Migrations
# ---------------------------------------------------------
def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------
# Online Migrations
# ---------------------------------------------------------
def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
