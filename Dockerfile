# --- Stage 1: Builder ---
# Use the full Python image to build dependencies that might have system build requirements.
FROM python:3.11 as builder

WORKDIR /app

# Create and activate a virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install dependencies into the virtual environment
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Final Image ---
# Use the slim image for a smaller final footprint.
FROM python:3.11-slim

WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy only the necessary application code
COPY src/ src/
COPY .env* ./
COPY start_production.sh .
RUN chmod +x start_production.sh

# Expose port and run
EXPOSE 8000
CMD ["./start_production.sh"]