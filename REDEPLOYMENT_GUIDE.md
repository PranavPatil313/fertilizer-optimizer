# Railway Redeployment Guide

## Issue Analysis

Your current deployment is failing with these errors:
1. `line 61: exec: gunicorn: not found` - Gunicorn not installed
2. `ML model not found at src/artifact/model.pkl` - Model files not included in Docker build
3. Asyncpg driver error - Railway's DATABASE_URL not compatible with async SQLAlchemy

## Root Cause

The deployed code is an **older version** without the fixes we've implemented. The error shows `line 61` but our fixed `start_production.sh` has gunicorn at line 88, confirming this.

## All Fixes Are Now Implemented

We've fixed all deployment issues:

### ✅ 1. Gunicorn Installation Fix
- **File**: `Dockerfile`
- **Fix**: Added runtime package installation (`RUN pip install --no-cache-dir -r requirements.txt`) in the runtime stage
- **Result**: Gunicorn will be available in the Docker container

### ✅ 2. Gunicorn Fallback Mechanism
- **File**: `start_production.sh` (lines 84-104)
- **Fix**: Added check for gunicorn availability with fallback to uvicorn
- **Code**:
  ```bash
  if command -v gunicorn >/dev/null 2>&1; then
      echo "Starting with Gunicorn..."
      exec gunicorn ...
  else
      echo "Gunicorn not found, falling back to Uvicorn..."
      exec uvicorn ...
  fi
  ```

### ✅ 3. Async URL Conversion for Railway
- **File**: `src/db/session.py`
- **Fix**: Added `get_async_database_url()` function that automatically converts Railway's `postgresql://` URLs to `postgresql+asyncpg://`
- **Result**: No more "async driver required" errors

### ✅ 4. Model File Inclusion
- **File**: `.dockerignore`
- **Fix**: Added negation patterns to include model files while excluding other artifacts
- **Patterns**:
  ```
  !src/artifact/model.pkl
  !src/artifact/model_artifact_v1.pkl
  !src/artifact/preprocessor.pkl
  !src/artifact/metadata.json
  ```

## Redeployment Steps

### Step 1: Commit All Changes
```bash
git add .
git commit -m "Fix Railway deployment issues: gunicorn, asyncpg, model files"
git push origin main
```

### Step 2: Trigger New Railway Deployment

#### Option A: Via Railway Dashboard
1. Go to [Railway.app](https://railway.app)
2. Select your Fertilizer Optimizer project
3. Click "Deployments" tab
4. Click "Manual Deploy" → "Deploy from GitHub branch"
5. Select your repository and branch (main)
6. Click "Deploy"

#### Option B: Via Railway CLI
```bash
railway up
```

### Step 3: Verify Deployment

After deployment completes, check:

1. **Build Logs**: Ensure no errors during Docker build
2. **Runtime Logs**: Check application startup
3. **Health Check**: Verify the application is running at your Railway URL

### Step 4: Test the Application

1. Open your Railway URL in browser
2. Test the frontend interface
3. Test prediction functionality
4. Verify database connections work

## Expected Successful Output

After redeployment with fixed code, you should see:

```
🚀 Starting Fertilizer Optimizer in production mode...
📦 Running inside Docker container
🌍 Environment: production
🗄️  Running database migrations...
✅ Database migrations completed
🚀 Starting with Gunicorn (production mode)...
[INFO] Starting gunicorn 21.2.0
[INFO] Listening at: http://0.0.0.0:8000
[INFO] Using worker: uvicorn.workers.UvicornWorker
```

## Troubleshooting

If issues persist after redeployment:

### 1. Check Railway Environment Variables
- Ensure `DATABASE_URL` is set by Railway (auto-injected)
- Verify other required variables are set

### 2. Check Build Logs
- Look for Docker build errors
- Verify model files are copied (should show `COPY` statements for `.pkl` files)

### 3. Check Runtime Logs
- Look for async URL conversion message
- Verify gunicorn starts successfully

### 4. Force Complete Rebuild
If Railway cached the old Docker image:
1. Go to Railway project → Settings → General
2. Click "Clear Build Cache"
3. Redeploy

## Verification Script

We've created a verification script to check fixes locally:
```bash
python verify_fixes.py
```

This checks:
- Model files exist
- Async URL conversion works
- Startup script has fallback mechanisms
- Dockerfile has runtime package installation

## Summary

**The deployment errors are fixed in the codebase.** You need to redeploy the updated code to Railway. The old deployment is using code without these fixes.

Once you redeploy, all three issues should be resolved:
1. ✅ Gunicorn will be available (or fallback to uvicorn)
2. ✅ Model files will be included in Docker image
3. ✅ Async database connections will work with Railway's DATABASE_URL

**Next Action**: Commit and push your changes, then trigger a new deployment on Railway.