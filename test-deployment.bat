@echo off
REM Test script for local cloud deployment verification (Windows version)
REM This script tests the Docker Compose setup locally

echo === Fertilizer Optimizer - Local Deployment Test ===
echo Testing date: %date% %time%
echo.

REM Check if docker is available
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker not found. Please install Docker Desktop.
    exit /b 1
)

REM Check if docker-compose is available
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    set DOCKER_COMPOSE=docker-compose
) else (
    echo docker-compose not found, using docker compose
    set DOCKER_COMPOSE=docker compose
)

echo 1. Building Docker images...
%DOCKER_COMPOSE% build --no-cache
if %errorlevel% neq 0 (
    echo ERROR: Docker build failed.
    exit /b 1
)

echo.
echo 2. Starting services in detached mode...
%DOCKER_COMPOSE% up -d
if %errorlevel% neq 0 (
    echo ERROR: Failed to start services.
    exit /b 1
)

echo.
echo 3. Waiting for services to be healthy (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo 4. Checking service status...
%DOCKER_COMPOSE% ps

echo.
echo 5. Testing backend API health...
curl -s -o nul -w "%%{http_code}" http://localhost:8000/ > backend_health.txt
set /p BACKEND_HEALTH=<backend_health.txt
del backend_health.txt

if "%BACKEND_HEALTH%"=="200" (
    echo ✓ Backend API is healthy (HTTP 200)
) else (
    echo ✗ Backend API health check failed: HTTP %BACKEND_HEALTH%
    echo Debug info:
    curl -v http://localhost:800/
)

echo.
echo 6. Testing backend API prediction endpoint...
curl -s -o nul -w "%%{http_code}" -X POST http://localhost:8000/predict ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: test-api-key-12345" ^
  -d "{\"crop_type\": \"wheat\", \"soil_ph\": 6.5, \"soil_n\": 25.0, \"soil_p\": 15.0, \"soil_k\": 200.0, \"temperature\": 25.0, \"rainfall\": 500.0, \"humidity\": 65.0, \"plot_size\": 1.0}" > prediction_test.txt
set /p PREDICTION_TEST=<prediction_test.txt
del prediction_test.txt

if "%PREDICTION_TEST%"=="200" (
    echo ✓ Prediction endpoint is responding (HTTP 200)
) else if "%PREDICTION_TEST%"=="422" (
    echo ✓ Prediction endpoint is responding (HTTP 422 - validation expected)
) else (
    echo ✗ Prediction endpoint test failed: HTTP %PREDICTION_TEST%
)

echo.
echo 7. Testing frontend accessibility...
curl -s -o nul -w "%%{http_code}" http://localhost:5173/ > frontend_test.txt
set /p FRONTEND_TEST=<frontend_test.txt
del frontend_test.txt

if "%FRONTEND_TEST%"=="200" (
    echo ✓ Frontend is accessible (HTTP 200)
) else (
    echo ✗ Frontend accessibility test failed: HTTP %FRONTEND_TEST%
    echo Note: Frontend may take longer to build. Try again in a moment.
)

echo.
echo 8. Checking database connectivity...
docker exec fertilizer-postgres pg_isready -U fertilizer_user -d fertilizer_db >nul 2>nul
if %errorlevel% equ 0 (
    echo ✓ Database is ready and accepting connections
) else (
    echo ✗ Database connectivity check failed
)

echo.
echo 9. Checking container logs for errors...
echo --- Backend logs (last 10 lines) ---
docker logs fertilizer-backend --tail 10 2>nul | findstr /i "error exception fail" || echo No errors found in recent logs

echo.
echo --- Frontend logs (last 10 lines) ---
docker logs fertilizer-frontend --tail 10 2>nul | findstr /i "error exception fail" || echo No errors found in recent logs

echo.
echo === Test Summary ===
echo Backend Health: %BACKEND_HEALTH%
echo Prediction Test: %PREDICTION_TEST%
echo Frontend Access: %FRONTEND_TEST%
echo.
echo To view full logs: %DOCKER_COMPOSE% logs
echo To stop services: %DOCKER_COMPOSE% down
echo To access the application:
echo   - Backend API: http://localhost:8000
echo   - Frontend: http://localhost:5173
echo   - PGAdmin: http://localhost:5050 (admin@fertilizer.com / admin123)
echo.
echo Test completed at: %date% %time%