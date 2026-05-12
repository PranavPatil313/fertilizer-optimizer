FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ src/
COPY .env* ./

# Copy and prepare startup script
COPY start_production.sh .
RUN chmod +x start_production.sh

# Expose port and run
EXPOSE 8000
CMD ["./start_production.sh"]