# Fertilizer Optimizer - Quick Deployment to Railway

## One-Click Deployment
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fertilizer-optimizer?referralCode=template)

## Manual Deployment Steps

### 1. Deploy Backend
1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `fertilizer-optimizer` repository
4. Railway will auto-detect Dockerfile and deploy

### 2. Add PostgreSQL Database
1. In Railway dashboard, click "New" → "Database" → "PostgreSQL"
2. Railway auto-creates `DATABASE_URL` environment variable

### 3. Configure Environment Variables
Add these in Railway dashboard → Backend service → Variables:

```env
# Required
DATABASE_URL=postgresql+asyncpg://... (auto-set by Railway, but ensure it has +asyncpg)
JWT_SECRET=generate_strong_random_string_32+_chars
API_KEY=your_production_api_key
CORS_ORIGINS=https://your-frontend.vercel.app

# Optional
WEATHER_API_KEY=your_openweathermap_key
ADMIN_EMAILS=admin@example.com
```

### 4. Deploy Frontend (Vercel - Recommended)
1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repository
3. Configure:
   - Framework: Vite
   - Root Directory: `fert-frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables:
   - `VITE_API_BASE_URL`: Your Railway backend URL
   - `VITE_API_KEY`: Same as backend API_KEY

### 5. Update CORS
In Railway backend variables, update `CORS_ORIGINS` to include your Vercel frontend URL.

### 6. Run Migrations
```bash
railway run alembic upgrade head
```

## Fix for Common AsyncPG Error
If you see: `"The asyncio extension requires an async driver. The loaded 'psycopg2' is not async."`

**Solution**: The application automatically converts `postgresql://` to `postgresql+asyncpg://`. If issue persists:

1. Manually update DATABASE_URL in Railway variables to include `+asyncpg`:
   - Change: `postgresql://user:pass@host/db`
   - To: `postgresql+asyncpg://user:pass@host/db`

2. Or set `RUN_MIGRATIONS=false` and run migrations manually after deployment.

## Testing Deployment
```bash
# Test backend
curl https://your-backend.railway.app/

# Test prediction
curl -X POST https://your-backend.railway.app/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"crop_type":"wheat","soil_ph":6.5}'
```

## Support
- Check `RAILWAY_DEPLOYMENT_GUIDE.md` for detailed instructions
- View logs: Railway dashboard → "Logs" tab
- Report issues: GitHub repository