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
    echo "📝 Loading environment variables from .env (only if not already set)"
    # Handle Windows line endings (CRLF) and filter out comments more robustly
    # Also handle inline comments and empty lines properly
    while IFS= read -r line || [ -n "$line" ]; do
        # Remove Windows carriage return
        line="${line%$'\r'}"
        # Skip empty lines and lines starting with #
        if [ -z "$line" ] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        # Remove inline comments (everything after #)
        line="${line%%#*}"
        # Trim trailing whitespace
        line="${line%"${line##*[![:space:]]}"}"
        # Export the variable if it contains an equals sign and is not already set
        if [[ "$line" =~ ^([[:alnum:]_][[:alnum:]_]*)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"
            # Only set if not already defined
            if [ -z "${!var_name}" ]; then
                export "$var_name=$var_value"
                echo "  Set $var_name from .env"
            else
                echo "  Skipping $var_name (already set to: ${!var_name})"
            fi
        fi
    done < .env
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
    # Check if gunicorn is available
    if command -v gunicorn >/dev/null 2>&1; then
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
        echo "⚠️  Gunicorn not found, falling back to Uvicorn..."
        echo "🔧 Starting with Uvicorn (production fallback)..."
        exec uvicorn src.api.main:app \
            --host $HOST \
            --port $PORT \
            --workers $WORKERS \
            --log-level info
    fi
else
    # Development mode with single worker
    echo "🔧 Starting with Uvicorn (development mode)..."
    exec uvicorn src.api.main:app \
        --host $HOST \
        --port $PORT \
        --reload \
        --log-level info
fi