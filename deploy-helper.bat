@echo off
REM Fertilizer Optimizer - Deployment Helper Script (Windows)
REM This script helps with the deployment process

echo ========================================
echo FERTILIZER OPTIMIZER - DEPLOYMENT HELPER
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "docker-compose.yml" (
    echo ERROR: Please run this script from the project root directory
    exit /b 1
)

echo 1. Checking prerequisites...
echo ---------------------------

REM Check Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop.
    exit /b 1
)
echo ✅ Docker is installed

REM Check Docker Compose
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    set DOCKER_COMPOSE=docker-compose
) else (
    docker compose version >nul 2>nul
    if %errorlevel% equ 0 (
        set DOCKER_COMPOSE=docker compose
    ) else (
        echo ❌ Docker Compose is not available.
        exit /b 1
    )
)
echo ✅ Docker Compose is available

REM Check Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Git is not installed.
    exit /b 1
)
echo ✅ Git is installed

echo.
echo 2. Checking local deployment...
echo -------------------------------

REM Check if services are running
docker ps | findstr "fertilizer-backend" >nul
if %errorlevel% equ 0 (
    echo ✅ Backend container is running
) else (
    echo ⚠️  Backend container is not running
    echo    To start: docker compose up -d
)

docker ps | findstr "fertilizer-frontend" >nul
if %errorlevel% equ 0 (
    echo ✅ Frontend container is running
) else (
    echo ⚠️  Frontend container is not running
)

docker ps | findstr "fertilizer-postgres" >nul
if %errorlevel% equ 0 (
    echo ✅ PostgreSQL container is running
) else (
    echo ⚠️  PostgreSQL container is not running
)

echo.
echo 3. Testing API connectivity...
echo -------------------------------

REM Test backend API
curl -s http://localhost:8000/ >nul
if %errorlevel% equ 0 (
    echo ✅ Backend API is responding
    curl -s http://localhost:8000/
) else (
    echo ❌ Backend API is not responding
)

echo.
echo 4. Database Migration Status
echo ----------------------------
echo Checking if migrations need to be run...

REM Check if alembic is available
where alembic >nul 2>nul
if %errorlevel% equ 0 (
    echo Running database migrations check...
    alembic current
    echo.
    echo To run migrations: alembic upgrade head
) else (
    echo ⚠️  Alembic not found in PATH
    echo Install with: pip install alembic
)

echo.
echo 5. Deployment Options
echo ---------------------
echo A) Deploy to Railway + Vercel (Recommended)
echo B) Deploy using Docker Compose to cloud VM
echo C) Manual deployment
echo.
set /p DEPLOY_OPTION="Choose option (A/B/C): "

if "%DEPLOY_OPTION%"=="A" goto option_a
if "%DEPLOY_OPTION%"=="a" goto option_a
if "%DEPLOY_OPTION%"=="B" goto option_b
if "%DEPLOY_OPTION%"=="b" goto option_b
if "%DEPLOY_OPTION%"=="C" goto option_c
goto invalid_option

:option_a
echo.
echo 🚀 Railway + Vercel Deployment
echo ==============================
echo.
echo Follow these steps:
echo 1. Push code to GitHub:
echo    git add .
echo    git commit -m "Deploy to cloud"
echo    git push origin main
echo.
echo 2. Deploy backend to Railway:
echo    - Go to https://railway.app
echo    - Click "New Project" -> "Deploy from GitHub"
echo    - Select your repository
echo    - Add environment variables from .env.example
echo.
echo 3. Deploy frontend to Vercel:
echo    - Go to https://vercel.com
echo    - Import GitHub repository
echo    - Set root directory to "fert-frontend"
echo    - Add VITE_API_BASE_URL environment variable
echo.
echo 4. Update CORS in Railway:
echo    - Add your Vercel URL to CORS_ORIGINS
echo.
echo 5. Run database migrations:
echo    railway run alembic upgrade head
goto end

:option_b
echo.
echo ☁️  Docker Compose to Cloud VM
echo ==============================
echo.
echo 1. Set up a cloud VM (DigitalOcean, AWS, Azure, GCP)
echo 2. Install Docker and Docker Compose on the VM
echo 3. Copy the project to the VM:
echo    scp -r . user@your-vm-ip:/opt/fertilizer-optimizer
echo 4. SSH into the VM:
echo    ssh user@your-vm-ip
echo 5. Deploy:
echo    cd /opt/fertilizer-optimizer
echo    docker compose up -d
echo 6. Configure firewall to open ports 80/443
echo 7. Set up Nginx reverse proxy and SSL (Let's Encrypt)
goto end

:option_c
echo.
echo 📋 Manual Deployment
echo ===================
echo.
echo Refer to DEPLOYMENT_CHECKLIST.md for detailed instructions
goto end

:invalid_option
echo Invalid option
goto end

:end
echo.
echo 📚 Additional Resources
echo ======================
echo - DEPLOYMENT_CHECKLIST.md - Complete deployment checklist
echo - DEPLOYMENT_GUIDE.md - Detailed deployment guide
echo - QUICK_DEPLOYMENT.md - Quick start guide
echo.
echo ✅ Deployment helper completed
pause