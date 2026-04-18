# Fertilizer Optimizer - Command Reference

## Quick Start Commands

### 1. Run Locally (Fastest)
```bash
# Fix asyncpg issue on Windows
fix_asyncpg.bat

# Start backend API
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, start frontend
cd fert-frontend
npm install
npm run dev
```

### 2. Run with Docker Compose
```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

### 3. Interactive Menu
```bash
# Use the interactive script
run_locally.bat
```

## Development Commands

### Backend
```bash
# Run tests
pytest

# Run with auto-reload
uvicorn src.api.main:app --reload

# Run production server
gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.api.main:app

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend
```bash
cd fert-frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing Commands

### Test API Endpoints
```bash
# Test root endpoint
curl http://localhost:8000/

# Test with PowerShell
powershell -Command "Invoke-WebRequest -Uri 'http://localhost:8000/'"

# Test predict endpoint
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"crop":"wheat","soil_type":"loam","ph":6.5,"organic_matter":2.5,"N":150,"P":25,"K":120,"rainfall_mm":500,"temperature_c":25,"region":"north","irrigation":"yes","previous_crop":"fallow"}'

# Use test script
test_api.bat
```

### Test Database Connection
```bash
# Connect to PostgreSQL
docker exec -it fertilizer-postgres psql -U postgres -d fertilizer_db

# Check tables
\dt

# Run SQL
SELECT * FROM users LIMIT 5;
```

## Deployment Commands

### Railway Deployment
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

### Vercel Deployment
```bash
cd fert-frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Troubleshooting Commands

### Fix Common Issues
```bash
# Fix asyncpg on Windows
fix_asyncpg.bat

# Rebuild Docker images
docker compose build --no-cache

# Reset database
docker compose down -v
docker compose up -d postgres
alembic upgrade head

# Check Python dependencies
pip install -r requirements.txt

# Check Node.js dependencies
cd fert-frontend && npm install
```

### System Checks
```bash
# Check Docker
docker --version
docker compose version

# Check Python
python --version
pip --version

# Check Node.js
node --version
npm --version
```

## Monitoring Commands

### Container Management
```bash
# List all containers
docker ps -a

# View container logs
docker logs fertilizer-backend --tail 50

# View container resource usage
docker stats

# Execute command in container
docker exec -it fertilizer-backend bash

# Restart specific service
docker compose restart backend
```

### Database Management
```bash
# Backup database
docker exec fertilizer-postgres pg_dump -U postgres fertilizer_db > backup.sql

# Restore database
docker exec -i fertilizer-postgres psql -U postgres fertilizer_db < backup.sql

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d postgres
```

## Environment Variables

Create `.env` file with:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fertilizer_db
SECRET_KEY=your-secret-key-here
ENV=development
DEBUG=true
```

For production, use:
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
SECRET_KEY=strong-random-secret
ENV=production
DEBUG=false