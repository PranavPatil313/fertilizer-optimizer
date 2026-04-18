# Run Fertilizer Optimizer Locally

This guide provides multiple options to run the Fertilizer Optimizer application locally.

## Option 1: Docker Compose (Recommended)

The easiest way to run the full stack locally is using Docker Compose.

### Prerequisites
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

### Steps

1. **Start all services**:
   ```bash
   docker compose up -d
   ```

2. **Check service status**:
   ```bash
   docker ps
   ```
   You should see 4 containers running:
   - `fertilizer-postgres` (PostgreSQL database on port 5433)
   - `fertilizer-backend` (FastAPI backend on port 8000)
   - `fertilizer-frontend` (React frontend on port 5173)
   - `fertilizer-pgadmin` (pgAdmin on port 5050)

3. **Verify services are working**:

   **Backend API** (should return JSON):
   ```bash
   curl http://localhost:8000/
   ```
   Expected response: `{"message":"FertilizerOptimizer prototype running. Available endpoints: /predict, /soil-health, /carbon, /recommend, /report"}`

   **Test prediction endpoint**:
   ```bash
   curl -X POST http://localhost:8000/predict \
     -H "Content-Type: application/json" \
     -H "X-API-Key: test-api-key-12345" \
     -d '{
       "crop_type": "wheat",
       "soil_type": "loam",
       "region": "north",
       "avg_temp": 25.0,
       "rainfall_mm": 500.0,
       "crop_duration_days": 120,
       "soil_N": 50.0,
       "soil_P": 30.0,
       "soil_K": 40.0,
       "pH": 6.5,
       "organic_matter_pct": 2.5,
       "irrigation_type": "drip",
       "area_acre": 10.0
     }'
   ```

   **Frontend** (open in browser):
   - URL: http://localhost:5173

4. **View logs**:
   ```bash
   # Backend logs
   docker logs fertilizer-backend --tail 20
   
   # Frontend logs
   docker logs fertilizer-frontend --tail 20
   
   # Database logs
   docker logs fertilizer-postgres --tail 20
   ```

5. **Stop services**:
   ```bash
   docker compose down
   ```

## Option 2: Run Backend Locally (Without Docker)

If you want to run the backend directly on your machine:

### Prerequisites
- Python 3.12+
- PostgreSQL (or use SQLite fallback)

### Steps

1. **Create and activate virtual environment**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/Mac:
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Fix asyncpg issue (Windows only)**:
   If you get `ModuleNotFoundError: No module named 'asyncpg.protocol.protocol'`, run:
   ```bash
   fix_asyncpg.bat
   ```
   Or manually:
   ```bash
   pip uninstall asyncpg -y
   pip install asyncpg==0.29.0 --no-binary asyncpg
   ```

4. **Set up environment variables**:
   Copy `.env.example` to `.env` and update if needed:
   ```bash
   copy .env.example .env
   ```

5. **Run the backend**:
   ```bash
   uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. **Test the API**:
   ```bash
   curl http://localhost:8000/
   ```

## Option 3: Run Frontend Locally (Without Docker)

### Prerequisites
- Node.js 18+

### Steps

1. **Navigate to frontend directory**:
   ```bash
   cd fert-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access frontend**:
   - URL: http://localhost:5173

## Option 4: SQLite Mode (Simplest)

If you don't want to use PostgreSQL, you can run the backend in SQLite mode:

1. **Modify `.env` file**:
   ```
   DATABASE_URL=sqlite:///./test.db
   USE_SQLITE=true
   ```

2. **Run backend** (as in Option 2, steps 1-3, 5)

## Troubleshooting

### Backend container fails with "ModuleNotFoundError: No module named 'tqdm'"
The Docker image might need to be rebuilt:
```bash
docker compose down
docker compose build --no-cache backend
docker compose up -d backend
```

### Frontend not accessible on port 5173
Check if the frontend container is running:
```bash
docker logs fertilizer-frontend
```
If nginx is not serving files, rebuild the frontend:
```bash
docker compose down
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Database connection issues
Ensure PostgreSQL is running and accessible:
```bash
docker logs fertilizer-postgres
```

### Port conflicts
If ports are already in use, modify `docker-compose.yml` to use different ports.

## Quick Test Commands

Here are quick commands to verify everything is working:

```bash
# Test backend
curl -f http://localhost:8000/

# Test prediction
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -H "X-API-Key: test-api-key-12345" -d "{\"crop_type\": \"wheat\", \"soil_type\": \"loam\", \"region\": \"north\", \"avg_temp\": 25.0, \"rainfall_mm\": 500.0, \"crop_duration_days\": 120, \"soil_N\": 50.0, \"soil_P\": 30.0, \"soil_K\": 40.0, \"pH\": 6.5, \"organic_matter_pct\": 2.5, \"irrigation_type\": \"drip\", \"area_acre\": 10.0}"

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Access Points

- **Backend API**: http://localhost:8000
- **Frontend App**: http://localhost:5173
- **pgAdmin**: http://localhost:5050 (login: admin@admin.com / admin)
- **PostgreSQL**: localhost:5433 (user: fertilizer_user, password: fertilizer_password, database: fertilizer_db)

## Next Steps

Once the application is running locally, you can:
1. Test all API endpoints
2. Use the frontend interface
3. Run database migrations: `alembic upgrade head`
4. Deploy to production using the deployment guide