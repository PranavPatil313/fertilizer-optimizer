#!/bin/bash
# Fertilizer Optimizer - Deployment Helper Script
# This script helps with the deployment process

echo "========================================"
echo "FERTILIZER OPTIMIZER - DEPLOYMENT HELPER"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: Please run this script from the project root directory"
    exit 1
fi

echo "1. Checking prerequisites..."
echo "---------------------------"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi
echo "✅ Docker is installed"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not available."
        exit 1
    fi
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi
echo "✅ Docker Compose is available"

# Check Git
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed."
    exit 1
fi
echo "✅ Git is installed"

echo ""
echo "2. Checking local deployment..."
echo "-------------------------------"

# Check if services are running
if docker ps | grep -q "fertilizer-backend"; then
    echo "✅ Backend container is running"
else
    echo "⚠️  Backend container is not running"
    echo "   To start: docker compose up -d"
fi

if docker ps | grep -q "fertilizer-frontend"; then
    echo "✅ Frontend container is running"
else
    echo "⚠️  Frontend container is not running"
fi

if docker ps | grep -q "fertilizer-postgres"; then
    echo "✅ PostgreSQL container is running"
else
    echo "⚠️  PostgreSQL container is not running"
fi

echo ""
echo "3. Testing API connectivity..."
echo "-------------------------------"

# Test backend API
if curl -s http://localhost:8000/ > /dev/null; then
    echo "✅ Backend API is responding"
    curl -s http://localhost:8000/ | jq -r '.message' 2>/dev/null || curl -s http://localhost:8000/
else
    echo "❌ Backend API is not responding"
fi

echo ""
echo "4. Deployment Options"
echo "---------------------"
echo "A) Deploy to Railway + Vercel (Recommended)"
echo "B) Deploy using Docker Compose to cloud VM"
echo "C) Manual deployment"
echo ""
read -p "Choose option (A/B/C): " DEPLOY_OPTION

case $DEPLOY_OPTION in
    A|a)
        echo ""
        echo "🚀 Railway + Vercel Deployment"
        echo "=============================="
        echo ""
        echo "Follow these steps:"
        echo "1. Push code to GitHub:"
        echo "   git add ."
        echo "   git commit -m 'Deploy to cloud'"
        echo "   git push origin main"
        echo ""
        echo "2. Deploy backend to Railway:"
        echo "   - Go to https://railway.app"
        echo "   - Click 'New Project' → 'Deploy from GitHub'"
        echo "   - Select your repository"
        echo "   - Add environment variables from .env.example"
        echo ""
        echo "3. Deploy frontend to Vercel:"
        echo "   - Go to https://vercel.com"
        echo "   - Import GitHub repository"
        echo "   - Set root directory to 'fert-frontend'"
        echo "   - Add VITE_API_BASE_URL environment variable"
        echo ""
        echo "4. Update CORS in Railway:"
        echo "   - Add your Vercel URL to CORS_ORIGINS"
        echo ""
        echo "5. Run database migrations:"
        echo "   railway run alembic upgrade head"
        ;;
    B|b)
        echo ""
        echo "☁️  Docker Compose to Cloud VM"
        echo "=============================="
        echo ""
        echo "1. Set up a cloud VM (DigitalOcean, AWS, Azure, GCP)"
        echo "2. Install Docker and Docker Compose on the VM"
        echo "3. Copy the project to the VM:"
        echo "   scp -r . user@your-vm-ip:/opt/fertilizer-optimizer"
        echo "4. SSH into the VM:"
        echo "   ssh user@your-vm-ip"
        echo "5. Deploy:"
        echo "   cd /opt/fertilizer-optimizer"
        echo "   docker compose up -d"
        echo "6. Configure firewall to open ports 80/443"
        echo "7. Set up Nginx reverse proxy and SSL (Let's Encrypt)"
        ;;
    C|c)
        echo ""
        echo "📋 Manual Deployment"
        echo "==================="
        echo ""
        echo "Refer to DEPLOYMENT_CHECKLIST.md for detailed instructions"
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo ""
echo "📚 Additional Resources"
echo "======================"
echo "- DEPLOYMENT_CHECKLIST.md - Complete deployment checklist"
echo "- DEPLOYMENT_GUIDE.md - Detailed deployment guide"
echo "- QUICK_DEPLOYMENT.md - Quick start guide"
echo ""
echo "✅ Deployment helper completed"