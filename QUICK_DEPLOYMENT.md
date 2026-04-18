# Quick Deployment Guide for Fertilizer Optimizer

## 🚀 One-Click Deployment (Simplest)

### Option A: Deploy with Railway (Recommended)
1. **Click this button**: [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fertilizer-optimizer?referralCode=template)
   - This will create a new Railway project with everything configured
   - You'll need to connect your GitHub account

### Option B: Manual Deployment

## 📋 Prerequisites
- GitHub account
- Railway.app account (free)
- Vercel account (free)

## 🔧 Step-by-Step Deployment

### 1. Push Code to GitHub
```bash
# Run these commands in your terminal:
git remote add origin https://github.com/YOUR_USERNAME/fertilizer-optimizer.git
git branch -M main
git push -u origin main
```

### 2. Deploy Backend to Railway
1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `fertilizer-optimizer` repository
4. Railway will automatically:
   - Detect the `Dockerfile` and deploy
   - Create a PostgreSQL database
5. Add environment variables (Settings → Variables):
   ```
   SECRET_KEY=your-secret-key-here
   API_KEY=your-api-key-here
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

### 3. Deploy Frontend to Vercel
1. Go to [Vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your `fertilizer-optimizer` repository
4. Configure:
   - Framework: Vite
   - Root Directory: `fert-frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variables:
   ```
   VITE_API_URL=https://your-railway-backend.up.railway.app
   VITE_API_KEY=your-api-key-here
   ```

### 4. Test Your Deployment
- Backend: `https://your-railway-backend.up.railway.app`
- Frontend: `https://your-vercel-frontend.vercel.app`

## 📱 Mobile Access
Once deployed, your application is accessible from any mobile device:
- Open the Vercel frontend URL on your phone
- The responsive design works on all screen sizes
- No app installation required (progressive web app)

## 🔒 Security Notes
1. **Generate strong keys**:
   ```bash
   # Generate a secure SECRET_KEY
   openssl rand -hex 32
   
   # Generate a secure API_KEY
   openssl rand -hex 16
   ```

2. **Update CORS_ORIGINS** with your exact frontend URL

3. **Enable rate limiting** (already configured)

## 🚨 Troubleshooting

### Backend won't start
- Check Railway logs: Project → "Logs" tab
- Verify environment variables are set
- Ensure PostgreSQL database is connected

### Frontend can't connect to backend
- Verify `VITE_API_URL` is correct
- Check CORS settings in backend
- Test backend directly: `curl https://your-backend-url/`

### Database connection issues
- Check `DATABASE_URL` in Railway variables
- Verify PostgreSQL service is running
- Check migration status in logs

## 📞 Support
- **Documentation**: See `DEPLOYMENT_GUIDE.md` for detailed instructions
- **GitHub Issues**: Report bugs or feature requests
- **Railway Discord**: Community support for deployment issues

## 🎉 Deployment Complete!
Your fertilizer optimizer is now live and accessible from mobile phones. Share the frontend URL with users to start getting fertilizer recommendations on their phones!