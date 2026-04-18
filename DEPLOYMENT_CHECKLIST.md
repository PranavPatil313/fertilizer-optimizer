# Fertilizer Optimizer - Deployment Checklist

## ✅ Prerequisites Check
- [x] Docker Desktop installed and running
- [x] Git installed
- [x] Local application tested and working
- [x] GitHub account
- [x] Railway.app account (free tier)
- [x] Vercel account (free tier)

## 📋 Current Status
- ✅ Local Docker containers running (backend, frontend, database)
- ✅ API responding at http://localhost:8000/
- ✅ Frontend running at http://localhost:5173/
- ✅ Git repository connected: https://github.com/PranavPatil313/fertilizer-optimizer.git

## 🚀 Step-by-Step Deployment Guide

### Step 1: Commit and Push Changes
```bash
# Add all changes
git add .

# Commit with deployment message
git commit -m "Prepare for cloud deployment"

# Push to GitHub
git push origin main
```

### Step 2: Deploy Backend to Railway

#### Option A: One-Click Deployment (Recommended)
1. Click the Railway button: [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fertilizer-optimizer?referralCode=template)
2. Connect your GitHub account
3. Railway will automatically:
   - Detect the Dockerfile and deploy
   - Create a PostgreSQL database
   - Generate a public URL

#### Option B: Manual Deployment
1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `fertilizer-optimizer` repository
4. Wait for deployment to complete
5. Add environment variables in Railway dashboard (Settings → Variables):

```env
DATABASE_URL=postgresql+asyncpg://[auto-generated]
SECRET_KEY=generate-a-strong-random-secret-here
API_KEY=your-production-api-key-here
JWT_SECRET=another-strong-random-secret-minimum-32-chars
CORS_ORIGINS=https://your-frontend.vercel.app
ENV=production
WEATHER_API_KEY=your-weather-api-key-optional
```

### Step 3: Deploy Frontend to Vercel

1. Go to [Vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your `fertilizer-optimizer` repository
4. Configure settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `fert-frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add environment variables:
   ```env
   VITE_API_BASE_URL=https://your-backend.railway.app
   VITE_API_KEY=your-production-api-key-here (must match backend API_KEY)
   ```
6. Click "Deploy"

### Step 4: Configure CORS and Update Environment Variables

After both deployments are complete:

1. **Update Backend CORS:**
   - Go to Railway dashboard → Backend service → Variables
   - Update `CORS_ORIGINS` to include your Vercel frontend URL:
     ```
     https://your-frontend.vercel.app,https://your-frontend-git-main-username.vercel.app
     ```

2. **Update Frontend API URL:**
   - Go to Vercel dashboard → Frontend project → Settings → Environment Variables
   - Update `VITE_API_BASE_URL` with your Railway backend URL

### Step 5: Run Database Migrations

```bash
# Using Railway CLI
railway run alembic upgrade head

# Or via Railway dashboard:
# 1. Go to your backend service
# 2. Click "Connect" → "Open Shell"
# 3. Run: alembic upgrade head
```

### Step 6: Test Deployed Application

1. **Test Backend API:**
   ```bash
   curl https://your-backend.railway.app/
   curl -X POST https://your-backend.railway.app/predict \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"crop_type":"wheat","soil_ph":6.5}'
   ```

2. **Test Frontend:**
   - Open your Vercel URL in browser
   - Test login/signup functionality
   - Test fertilizer recommendation form
   - Test PDF report generation

3. **Test Mobile Access:**
   - Open the Vercel URL on your mobile device
   - Test form inputs and navigation
   - Verify responsive design

## 🔧 Troubleshooting Common Issues

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set in Railway variables
- Check if PostgreSQL service is running in Railway
- Run migrations: `railway run alembic upgrade head`

### CORS Errors
- Ensure `CORS_ORIGINS` includes your exact frontend URL
- Include both `https://` and `http://` versions if testing locally
- Restart backend after updating CORS variables

### Frontend Build Failures
- Check Node.js version compatibility (requires Node 18+)
- Verify all dependencies in `fert-frontend/package.json`
- Check build logs in Vercel dashboard

### API Key Authentication
- Ensure `API_KEY` matches between backend and frontend
- Frontend should send `X-API-Key` header with all requests
- Backend should have `API_KEY_ENABLED=true`

## 📱 Mobile Optimization Verification

Checklist for mobile readiness:
- [ ] Responsive design works on various screen sizes
- [ ] Touch targets are appropriately sized (minimum 44x44px)
- [ ] Forms are mobile-friendly with appropriate input types
- [ ] Images are optimized and load quickly
- [ ] PWA features enabled (optional)
- [ ] Offline functionality (optional)

## 🔒 Security Checklist

- [ ] API keys are securely stored as environment variables
- [ ] JWT secrets are strong and unique
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Database credentials are not hardcoded
- [ ] HTTPS is enforced (automatic on Railway/Vercel)

## 📊 Monitoring and Maintenance

### Health Checks
- Backend: `GET /` should return 200
- Database: Connection test on startup
- Frontend: Static assets loading correctly

### Logs
- Railway: View logs in dashboard → Logs tab
- Vercel: View build and runtime logs in dashboard

### Updates
To update the deployed application:
1. Make changes locally
2. Commit and push to GitHub
3. Railway and Vercel will automatically redeploy

## 🆘 Support

If you encounter issues:
1. Check the deployment logs in Railway/Vercel
2. Review the `DEPLOYMENT_GUIDE.md` for detailed instructions
3. Run `test-deployment.bat` locally to verify everything works
4. Check Docker logs: `docker compose logs`

## ✅ Final Verification

Before announcing deployment:
- [ ] All endpoints respond correctly
- [ ] Database migrations completed
- [ ] Frontend loads without errors
- [ ] Mobile testing completed
- [ ] Security checks passed
- [ ] Performance is acceptable

Your application is now ready for mobile access! Share the Vercel URL with users to access the fertilizer optimizer from any device.