# Fertilizer Optimizer - Production Dockerfile
FROM python:3.12-slim

# Force Python to print logs immediately (prevents silent crashes)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (libgomp1 is CRITICAL for ML models like scikit-learn/xgboost)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir slowapi asyncpg python-multipart

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p src/artifact src/data/uploads src/data/processed && \
    chown -R appuser:appuser /app

# Fix Windows line endings in the startup script (prevents 'bad interpreter' crashes)
RUN sed -i 's/\r$//' start_production.sh
# Make startup script executable
RUN chmod +x start_production.sh

USER appuser

# Expose port
EXPOSE 8000

# Start the application
CMD ["./start_production.sh"]