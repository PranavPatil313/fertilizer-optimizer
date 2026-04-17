# Fertilizer Optimizer - Cloud Deployment Guide

This guide explains how to deploy the Fertilizer Optimizer application to cloud platforms for mobile access.

## Quick Deployment Options

### Option A: Railway.app (Recommended - Easiest)
1. **Create Railway Account** at [railway.app](https://railway.app)
2. **Create New Project** → "Deploy from GitHub"
3. **Connect your GitHub repository**
4. **Add PostgreSQL Database**:
   - Go to "New" → "Database" → "PostgreSQL"
   - Railway will auto-create `DATABASE_URL`
5. **Deploy Backend**:
   - Railway will detect the `Dockerfile` and deploy automatically
   - Add environment variables from `.env.example`
6. **Deploy Frontend**:
   - Create separate service for `fert-frontend` folder
   - Use Node.js environment
   - Build command: `npm run build`
   - Output directory: `dist`

### Option B: Render.com
1. **Create Render Account** at [render.com](https://render.com)
2. **Backend Service**:
   - New → "Web Service" → Connect GitHub repo
   - Environment: "Python"
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn src.api.main:app --host 0.0.0.0 --port 8000`
   - Add environment variables
3. **PostgreSQL Database**:
   - New → "PostgreSQL"
   - Copy connection string to `DATABASE_URL`
4. **Frontend Service**:
   - New → "Static Site"
   - Build Command: `cd fert-frontend && npm run build`
   - Publish directory: `fert-frontend/dist`

### Option C: Vercel + Railway (Best Performance)
1. **Backend on Railway** (as above)
2. **Frontend on Vercel**:
   - Import GitHub repo at [vercel.com](https://vercel.com)
   - Framework: "Vite"
   - Root directory: `fert-frontend`
   - Build command: `npm run build`
   - Environment: Add `VITE_API_BASE_URL` pointing to Railway backend

## Local Testing Before Deployment

Before deploying to the cloud, test the application locally using Docker Compose to ensure everything works correctly.

### Prerequisites
- Docker Desktop installed and running
- Git (for cloning the repository)

### Step-by-Step Local Test

1. **Clone and navigate to the project** (if not already):
  ```bash
  git clone <your-repo-url>
  cd fertilizer-optimizer
  ```

2. **Create environment files** (optional - defaults are in docker-compose.yml):
  ```bash
  cp .env.example .env
  cd fert-frontend && cp .env.example .env
  ```

3. **Start the full stack with Docker Compose**:
  ```bash
  docker compose up -d
  ```
  This will start:
  - PostgreSQL database on port 5432
  - Backend API on port 8000
  - Frontend on port 5173
  - PGAdmin on port 5050 (optional)

4. **Wait for services to be ready** (2-3 minutes for initial build):
  ```bash
  docker compose logs -f
  ```

5. **Run the automated test script** (Windows):
  ```bash
  test-deployment.bat
  ```
  Or on Linux/Mac:
  ```bash
  chmod +x test-deployment.sh
  ./test-deployment.sh
  ```

6. **Verify the application is working**:
  - Backend API: http://localhost:8000
  - Frontend: http://localhost:5173
  - PGAdmin: http://localhost:5050 (admin@fertilizer.com / admin123)

7. **Test mobile responsiveness**:
  - Open Chrome DevTools (F12)
  - Toggle device toolbar (Ctrl+Shift+M)
  - Test on various mobile screen sizes
  - Verify touch interactions work correctly

8. **Stop services when done**:
  ```bash
  docker compose down
  ```

### What the Test Script Checks
- ✅ Docker and docker-compose availability
- ✅ Service health (backend, frontend, database)
- ✅ API endpoint responsiveness
- ✅ Database connectivity
- ✅ Error-free container logs
- ✅ Mobile accessibility

### Troubleshooting Local Issues
- **Port conflicts**: Change ports in `docker-compose.yml`
- **Build failures**: Check `docker compose logs` for errors
- **Database issues**: Ensure PostgreSQL container is healthy
- **Frontend not loading**: Wait for build to complete (may take 5+ minutes first time)

## Environment Variables Setup

### Backend Variables (Required)
```env
DATABASE_URL=postgresql://user:pass@host:port/dbname
API_KEY=your_secret_api_key_here
JWT_SECRET=long_random_string_32_chars_minimum
CORS_ORIGINS=https://your-frontend-domain.vercel.app,https://mobile-app.example.com
ENV=production
RATE_LIMIT=60/minute
WEATHER_API_KEY=your_weather_api_key
```

### Frontend Variables
```env
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_API_KEY=your_secret_api_key_here  # Must match backend API_KEY
```

## Database Migration

After deployment, run database migrations:

```bash
# Locally (before deployment)
alembic upgrade head

# On Railway (using CLI)
railway run alembic upgrade head

# On Render (using SSH)
render ssh
cd /opt/render/project/src
alembic upgrade head
```

## Mobile Optimization Checklist

✅ **Already Implemented:**
- Responsive design with Tailwind CSS
- Mobile viewport meta tag
- Touch-friendly Material-UI components
- Optimized bundle size (Vite build)

🔧 **Recommended for Mobile:**
1. **Enable PWA** (see `PWA_SETUP.md`)
2. **Implement offline caching**
3. **Add mobile-specific error messages**
4. **Optimize image loading**

## Testing Mobile Access

1. **Test on Physical Device:**
   - Open deployed URL on mobile browser
   - Test form inputs, navigation, PDF download
   - Check loading speed on 3G/4G

2. **Chrome DevTools Mobile Testing:**
   - Open DevTools → Toggle Device Toolbar
   - Test various screen sizes
   - Simulate slow network (3G)

3. **API Testing:**
   ```bash
   curl https://your-backend.railway.app/
   curl -X POST https://your-backend.railway.app/predict -H "Content-Type: application/json" -d '{"crop_type":"wheat","soil_ph":6.5}'
   ```

## Monitoring & Maintenance

### Health Checks
- Backend: `GET /` should return 200
- Database: Check connection on startup
- ML Model: Verify model loading

### Logs
- Railway: `railway logs`
- Render: Dashboard → Logs
- Vercel: Dashboard → Analytics

### Scaling
- **Free Tier**: Suitable for testing (100+ users)
- **Production**: Upgrade to paid plans for:
  - Higher rate limits
  - More database connections
  - Better performance

## Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Check `CORS_ORIGINS` includes frontend domain
   - Ensure no trailing slashes in URLs

2. **Database Connection Failed**
   - Verify `DATABASE_URL` format
   - Check if database is publicly accessible
   - Test connection with `psql` or adminer

3. **ML Model Not Loading**
   - Verify `src/artifact/` folder exists in deployment
   - Check file permissions for model files
   - Test locally first

4. **Frontend Can't Connect to Backend**
   - Verify `VITE_API_BASE_URL` is correct
   - Check backend is running (`/` endpoint)
   - Test API directly from browser

## Security Best Practices

1. **Never commit `.env` files** to GitHub
2. **Rotate API keys** after deployment
3. **Use HTTPS** for all connections
4. **Enable rate limiting** in production
5. **Regularly update dependencies**
6. **Monitor for suspicious activity**

## Cost Estimation

| Platform | Service | Free Tier | Production Cost |
|----------|---------|-----------|-----------------|
| Railway | Backend + DB | $5/mo credit | ~$20-50/mo |
| Render | Backend + DB | Free tier limited | ~$15-30/mo |
| Vercel | Frontend | Always free | Free for most use |
| Supabase | Database | Free tier | ~$25/mo |

## Support

- **GitHub Issues**: Report bugs or feature requests
- **Documentation**: Check `PROJECT_STRUCTURE.md` for code details
- **Community**: Agricultural tech forums for domain-specific questions

## Next Steps After Deployment

1. **Set up custom domain** (optional)
2. **Configure SSL certificates** (auto on most platforms)
3. **Set up monitoring** (UptimeRobot, Sentry)
4. **Create backup strategy** for database
5. **Plan for scaling** as user base grows