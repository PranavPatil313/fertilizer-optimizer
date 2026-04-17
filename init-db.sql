-- Database initialization script for Fertilizer Optimizer
-- This script runs when PostgreSQL container starts

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create additional roles if needed (optional)
-- CREATE ROLE fertilizer_readonly WITH LOGIN PASSWORD 'readonly_password' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
-- GRANT CONNECT ON DATABASE fertilizer_db TO fertilizer_readonly;

-- Set up schema and permissions
\c fertilizer_db

-- Grant privileges to the main user
GRANT ALL PRIVILEGES ON DATABASE fertilizer_db TO fertilizer_user;

-- Create schema if using separate schema
-- CREATE SCHEMA IF NOT EXISTS fertilizer_schema;
-- GRANT ALL ON SCHEMA fertilizer_schema TO fertilizer_user;

-- Set search path (optional)
-- ALTER DATABASE fertilizer_db SET search_path TO fertilizer_schema, public;

-- Create tables will be created by SQLAlchemy/Alembic
-- This is just for any pre-table setup

-- Create a function for audit logging (optional)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Comment: The actual tables will be created by Alembic migrations
-- Run migrations after container starts using: alembic upgrade head