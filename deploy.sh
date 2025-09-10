#!/bin/bash

# Deployment Script for Responsive Savings Analyzer
# This script helps prepare and deploy the application

echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Step 1: Preparing files for deployment..."

# Create production requirements file
if [ ! -f "requirements.txt" ]; then
    echo "📦 Creating requirements.txt from requirements_production.txt..."
    cp requirements_production.txt requirements.txt
fi

# Create production main file
if [ ! -f "main.py" ] || [ -f "main_production.py" ]; then
    echo "🔧 Creating production main.py..."
    cp main_production.py main.py
fi

# Create .env file from template if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file from template..."
    cp env_template.txt .env
    echo "⚠️  Please update .env file with your actual values before deploying!"
fi

echo "✅ Files prepared successfully!"

echo ""
echo "📚 Next steps:"
echo "1. Update .env file with your actual environment variables"
echo "2. Update Google Client ID in signin.html and signin.js"
echo "3. Update API_BASE_URL in frontend JavaScript files"
echo "4. Deploy to Vercel (frontend) and Render (backend)"
echo ""
echo "📖 See DEPLOYMENT_GUIDE.md for detailed instructions"

echo ""
echo "🔗 Quick deployment commands:"
echo "Frontend (Vercel): vercel --prod"
echo "Backend (Render): Connect GitHub repo to Render"
echo ""
echo "🎉 Deployment preparation complete!"
