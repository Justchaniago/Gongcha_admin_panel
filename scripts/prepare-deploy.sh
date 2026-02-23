#!/bin/bash

# ============================================
# Deployment Preparation Script
# Run this before deploying to Vercel
# ============================================

echo "🚀 Preparing Gongcha Admin for Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env.local
    echo -e "${GREEN}✅ Created .env.local${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env.local with your actual values${NC}"
else
    echo -e "${GREEN}✅ .env.local exists${NC}"
fi

# Check for serviceAccountKey.json
if [ ! -f serviceAccountKey.json ]; then
    echo -e "${RED}❌ serviceAccountKey.json not found${NC}"
    echo "Please download from Firebase Console > Project Settings > Service Accounts"
    exit 1
else
    echo -e "${GREEN}✅ serviceAccountKey.json exists${NC}"
    
    # Encode to base64 for Vercel
    echo ""
    echo "🔑 Base64 encoded service account (copy this to Vercel):"
    echo ""
    base64 -i serviceAccountKey.json
    echo ""
fi

# Check git status
echo ""
echo "📦 Git Status:"
git status --short

echo ""
echo "📝 Pre-deployment Checklist:"
echo "  ☐ All environment variables set in .env.local"
echo "  ☐ Firebase Auth domain added to authorized domains"
echo "  ☐ Firestore rules deployed"
echo "  ☐ Firestore indexes deployed"
echo "  ☐ Git repository pushed to remote"
echo ""

echo -e "${GREEN}🚀 Ready for deployment!${NC}"
echo ""
echo "Next steps:"
echo "1. Add environment variables to Vercel Dashboard"
echo "2. Deploy using: vercel --prod"
echo ""
