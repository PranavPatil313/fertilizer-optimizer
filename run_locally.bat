@echo off
REM Script to run the Fertilizer Optimizer locally
REM This provides multiple options to run the project

echo ========================================
echo FERTILIZER OPTIMIZER - LOCAL RUN OPTIONS
echo ========================================
echo.

echo Option 1: Use Docker (Recommended - Already Working)
echo ----------------------------------------------------
echo docker compose up -d
echo.
echo This will start:
echo - Backend API: http://localhost:8000
echo - Frontend: http://localhost:5173
echo - PostgreSQL: localhost:5433
echo - PGAdmin: http://localhost:5050
echo.

echo Option 2: Fix asyncpg and run locally
echo --------------------------------------
echo This fixes the asyncpg compilation issue on Windows
echo.

echo Option 3: Run without database (Development mode)
echo --------------------------------------------------
echo Runs the API with SQLite instead of PostgreSQL
echo.

set /p CHOICE="Choose option (1/2/3): "

if "%CHOICE%"=="1" goto docker_option
if "%CHOICE%"=="2" goto fix_asyncpg_option
if "%CHOICE%"=="3" goto sqlite_option
goto invalid

:docker_option
echo.
echo Starting Docker containers...
docker compose up -d
echo.
echo ✅ Services started!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo To view logs: docker compose logs -f
echo To stop: docker compose down
goto end

:fix_asyncpg_option
echo.
echo Fixing asyncpg installation...
echo Step 1: Installing pre-compiled asyncpg wheel...
pip install asyncpg==0.29.0 --only-binary :all:

echo.
echo Step 2: Testing installation...
python -c "import asyncpg; print('✅ asyncpg version:', asyncpg.__version__)" 2>nul
if %errorlevel% neq 0 (
    echo ❌ Installation failed. Using alternative approach...
    echo Installing asyncpg 0.28.0 instead...
    pip install asyncpg==0.28.0 --only-binary :all:
)

echo.
echo Step 3: Starting the backend...
echo Note: You need PostgreSQL running or use Docker PostgreSQL
echo Starting uvicorn...
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
goto end

:sqlite_option
echo.
echo Running with SQLite (development mode)...
echo Creating .env file for SQLite...
(
echo DATABASE_URL=sqlite+aiosqlite:///./test.db
echo ENV=development
echo API_KEY=test-api-key-12345
echo JWT_SECRET=local-development-secret-key
echo CORS_ORIGINS=http://localhost:5173
) > .env.temp

echo.
echo Starting backend with SQLite...
set DATABASE_URL=sqlite+aiosqlite:///./test.db
set ENV=development
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
goto end

:invalid
echo Invalid choice
goto end

:end
echo.
echo ========================================
echo LOCAL RUN COMPLETE
echo ========================================
echo.
echo For deployment to cloud, run: deploy-helper.bat
pause