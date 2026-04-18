# Quick Start: Run Fertilizer Optimizer Locally

## Option 1: Fast Local Run (Recommended)
This method runs the backend directly on your machine without Docker, which is much faster:

1. **Fix asyncpg issue** (Windows only):
   ```bash
   fix_asyncpg.bat
   ```
   Or manually:
   ```bash
   pip uninstall asyncpg -y
   pip install asyncpg==0.29.0 --no-binary asyncpg
   ```

2. **Start the backend API**:
   ```bash
   uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Start the frontend** (in a new terminal):
   ```bash
   cd fert-frontend
   npm install
   npm run dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Option 2: Docker Compose (Slower but Complete)
If you prefer Docker, use the pre-built approach:

1. **Stop any running containers**:
   ```bash
   docker compose down
   ```

2. **Start all services**:
   ```bash
   docker compose up -d
   ```

3. **Check services are running**:
   ```bash
   docker compose ps
   ```

4. **Access the application**:
   - Frontend: http://localhost:80
   - Backend API: http://localhost:8000
   - PostgreSQL: localhost:5433 (user: postgres, password: postgres)
   - pgAdmin: http://localhost:5050 (email: admin@admin.com, password: admin)

## Option 3: Interactive Script
Use the provided script for an interactive experience:

```bash
run_locally.bat
```

This script gives you 3 options:
1. Run with Docker Compose
2. Fix asyncpg and run locally
3. Run with SQLite (no PostgreSQL required)

## Testing the API

Once the backend is running, test it with:

```bash
# Test root endpoint
curl http://localhost:8000/

# Or use the test script
test_api.bat
```

## Common Issues & Solutions

### 1. asyncpg ModuleNotFoundError
If you see `ModuleNotFoundError: No module named 'asyncpg.protocol.protocol'`:
- Run `fix_asyncpg.bat`
- Or use SQLite mode in `run_locally.bat`

### 2. tqdm ModuleNotFoundError (Docker)
If Docker container fails with `ModuleNotFoundError: No module named 'tqdm'`:
- The Docker build is still in progress (check Terminal 1)
- Wait for build to complete, then restart containers:
  ```bash
  docker compose down
  docker compose up -d
  ```

### 3. Port already in use
If port 8000 or 5433 is already in use:
- Change ports in `.env` file
- Or stop the conflicting service

## Next Steps

1. **Create an account** at http://localhost:5173/signup
2. **Create a plot** with your soil data
3. **Get fertilizer recommendations**
4. **Generate PDF reports**

## For Production Deployment

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for detailed deployment instructions to Railway (backend) and Vercel (frontend).