# Running Fertilizer Optimizer Locally

This guide provides multiple ways to run the fertilizer optimizer application locally.

## Prerequisites

- Docker and Docker Compose (for Docker method)
- Python 3.12+ (for native method)
- Node.js 18+ (for frontend development)

## Option 1: Docker Compose (Recommended)

The easiest way to run the full stack locally:

```bash
# Start all services (backend, frontend, PostgreSQL, pgAdmin)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

### Access Points:
- **Backend API**: http://localhost:8000
- **Frontend**: http://localhost:5173
- **PostgreSQL**: localhost:5433 (user: fertilizer_user, password: fertilizer_password)
- **pgAdmin**: http://localhost:5050 (email: admin@admin.com, password: admin)

### Health Check:
```bash
# Test backend API
curl http://localhost:8000/

# Test frontend
curl http://localhost:5173/
```

## Option 2: Native Python Backend + Frontend

### Backend Setup:
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows
# or source venv/bin/activate  # On Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Set environment variables
copy .env.example .env
# Edit .env file if needed

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup:
```bash
cd fert-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Option 3: SQLite Development Mode

For quick testing without PostgreSQL:

```bash
# Set environment variable to use SQLite
set DATABASE_URL=sqlite:///./test.db

# Run backend
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

## Troubleshooting

### 1. asyncpg ModuleNotFoundError on Windows
If you encounter `ModuleNotFoundError: No module named 'asyncpg.protocol.protocol'`:
```bash
# Run the fix script
.\fix_asyncpg.bat

# Or manually fix:
pip uninstall asyncpg -y
pip install asyncpg==0.29.0 --no-binary asyncpg
```

### 2. Docker Container Fails to Start
If Docker containers fail with dependency errors:
```bash
# Rebuild with clean cache
docker compose build --no-cache backend

# Check container logs
docker logs fertilizer-backend
```

### 3. Database Connection Issues
Ensure PostgreSQL is running:
```bash
# Check PostgreSQL container status
docker compose ps postgres

# Reset database
docker compose down -v
docker compose up -d postgres
```

## Quick Start Script

Use the provided `run_locally.bat` (Windows) or `run_locally.sh` (Linux/Mac) for an interactive menu:

```bash
.\run_locally.bat
```

This script offers 3 options:
1. **Docker Compose** - Full stack with containers
2. **Fix asyncpg & Run** - Fix Windows asyncpg issue and run natively
3. **SQLite Mode** - Run with SQLite database

## Testing the Application

Once running, test the endpoints:

1. **Health Check**: http://localhost:8000/
2. **API Documentation**: http://localhost:8000/docs
3. **Frontend**: http://localhost:5173/

Default API key for testing: `test-api-key-12345`

## Stopping the Application

### Docker Compose:
```bash
docker compose down
```

### Native:
- Press Ctrl+C in terminal windows
- Deactivate virtual environment: `deactivate`

## Next Steps

After verifying local operation, you can deploy to production using the deployment guide in `DEPLOYMENT_CHECKLIST.md`.