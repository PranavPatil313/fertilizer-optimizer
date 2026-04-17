#!/bin/bash
# Fertilizer Optimizer - Production Startup Script
# Use this script to start the application in production mode

set -e  # Exit on error

echo "🚀 Starting Fertilizer Optimizer in production mode..."

# Check if running in container
if [ -f /.dockerenv ]; then
    echo "📦 Running inside Docker container"
fi

# Load environment variables
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: .env file not found. Using system environment variables."
fi

# Set default environment
export ENV=${ENV:-production}
export DEBUG=${DEBUG:-false}

echo "🌍 Environment: $ENV"
echo "🐛 Debug mode: $DEBUG"

# Database migration (if needed)
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$ENV" = "production" ]; then
    echo "🗄️  Running database migrations..."
    alembic upgrade head
    echo "✅ Database migrations completed"
fi

# Create necessary directories
mkdir -p src/artifact src/data/uploads src/data/processed

# Check if ML model exists
if [ ! -f "src/artifact/model.pkl" ]; then
    echo "⚠️  Warning: ML model not found at src/artifact/model.pkl"
    echo "   The application will fail if model is required for predictions."
fi

# Start the FastAPI application
echo "⚡ Starting FastAPI server with Uvicorn..."

# Production settings
WORKERS=${WORKERS:-4}
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}

echo "👥 Workers: $WORKERS"
echo "🌐 Host: $HOST"
echo "🔌 Port: $PORT"

# Start Gunicorn with Uvicorn workers for production
# Use this for production deployment with multiple workers
if [ "$USE_GUNICORN" = "true" ] || [ "$ENV" = "production" ]; then
    echo "🚀 Starting with Gunicorn (production mode)..."
    exec gunicorn src.api.main:app \
        --workers $WORKERS \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind $HOST:$PORT \
        --timeout 120 \
        --keep-alive 5 \
        --access-logfile - \
        --error-logfile -
else
    # Development mode with single worker
    echo "🔧 Starting with Uvicorn (development mode)..."
    exec uvicorn src.api.main:app \
        --host $HOST \
        --port $PORT \
        --reload \
        --log-level info
fi