#!/bin/bash
# Test script for local cloud deployment verification
# This script tests the Docker Compose setup locally

set -e  # Exit on error

echo "=== Fertilizer Optimizer - Local Deployment Test ==="
echo "Testing date: $(date)"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose not found, using docker compose"
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "1. Building Docker images..."
$DOCKER_COMPOSE build --no-cache

echo ""
echo "2. Starting services in detached mode..."
$DOCKER_COMPOSE up -d

echo ""
echo "3. Waiting for services to be healthy (30 seconds)..."
sleep 30

echo ""
echo "4. Checking service status..."
$DOCKER_COMPOSE ps

echo ""
echo "5. Testing backend API health..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ || echo "curl failed")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo "✓ Backend API is healthy (HTTP 200)"
else
    echo "✗ Backend API health check failed: HTTP $BACKEND_HEALTH"
    echo "Debug info:"
    curl -v http://localhost:8000/ || true
fi

echo ""
echo "6. Testing backend API prediction endpoint..."
PREDICTION_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key-12345" \
  -d '{
    "crop_type": "wheat",
    "soil_ph": 6.5,
    "soil_n": 25.0,
    "soil_p": 15.0,
    "soil_k": 200.0,
    "temperature": 25.0,
    "rainfall": 500.0,
    "humidity": 65.0,
    "plot_size": 1.0
  }' || echo "999")

if [ "$PREDICTION_TEST" = "200" ] || [ "$PREDICTION_TEST" = "422" ]; then
    echo "✓ Prediction endpoint is responding (HTTP $PREDICTION_TEST)"
else
    echo "✗ Prediction endpoint test failed: HTTP $PREDICTION_TEST"
fi

echo ""
echo "7. Testing frontend accessibility..."
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ || echo "curl failed")
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✓ Frontend is accessible (HTTP 200)"
else
    echo "✗ Frontend accessibility test failed: HTTP $FRONTEND_TEST"
    echo "Note: Frontend may take longer to build. Try again in a moment."
fi

echo ""
echo "8. Checking database connectivity..."
DB_CHECK=$(docker exec fertilizer-postgres pg_isready -U fertilizer_user -d fertilizer_db 2>/dev/null && echo "ready" || echo "not ready")
if [ "$DB_CHECK" = "ready" ]; then
    echo "✓ Database is ready and accepting connections"
else
    echo "✗ Database connectivity check failed"
fi

echo ""
echo "9. Checking container logs for errors..."
echo "--- Backend logs (last 10 lines) ---"
docker logs fertilizer-backend --tail 10 2>/dev/null | grep -i "error\|exception\|fail" || echo "No errors found in recent logs"

echo ""
echo "--- Frontend logs (last 10 lines) ---"
docker logs fertilizer-frontend --tail 10 2>/dev/null | grep -i "error\|exception\|fail" || echo "No errors found in recent logs"

echo ""
echo "=== Test Summary ==="
echo "Backend Health: $BACKEND_HEALTH"
echo "Prediction Test: $PREDICTION_TEST"
echo "Frontend Access: $FRONTEND_TEST"
echo "Database Status: $DB_CHECK"
echo ""
echo "To view full logs: docker-compose logs"
echo "To stop services: docker-compose down"
echo "To access the application:"
echo "  - Backend API: http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo "  - PGAdmin: http://localhost:5050 (admin@fertilizer.com / admin123)"
echo ""
echo "Test completed at: $(date)"