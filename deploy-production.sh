#!/bin/bash

# AidIN Helpdesk - Production Deployment Script
# Version: v0.2.0
# This script automates the deployment process on DigitalOcean production server

set -e  # Exit on any error

echo "=========================================="
echo "🚀 AidIN Helpdesk Production Deployment"
echo "=========================================="
echo ""

# Configuration
APP_DIR="/var/www/aidin"
PM2_APP_NAME="aidin"
RELEASE_TAG="v0.2.0"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as correct user
echo "📋 Pre-deployment checks..."
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}❌ Please do not run this script as root${NC}"
   exit 1
fi

# Navigate to app directory
echo -e "${YELLOW}📂 Navigating to application directory...${NC}"
cd "$APP_DIR" || { echo -e "${RED}❌ Failed to navigate to $APP_DIR${NC}"; exit 1; }
echo -e "${GREEN}✓ Current directory: $(pwd)${NC}"
echo ""

# Backup current version
echo -e "${YELLOW}💾 Creating backup of current version...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "Current: $CURRENT_BRANCH @ $CURRENT_COMMIT"
echo "$CURRENT_BRANCH:$CURRENT_COMMIT" > .deployment-backup
echo -e "${GREEN}✓ Backup info saved${NC}"
echo ""

# Fetch latest changes
echo -e "${YELLOW}🔄 Fetching latest changes from GitHub...${NC}"
git fetch --all --tags --prune || { echo -e "${RED}❌ Git fetch failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Fetch complete${NC}"
echo ""

# Show available tags
echo "Available tags:"
git tag -l | tail -5
echo ""

# Checkout the release
echo -e "${YELLOW}📦 Checking out release ${RELEASE_TAG}...${NC}"
git checkout "$RELEASE_TAG" || { echo -e "${RED}❌ Failed to checkout $RELEASE_TAG${NC}"; exit 1; }
echo -e "${GREEN}✓ Checked out $RELEASE_TAG${NC}"
echo ""

# Show what changed
echo -e "${YELLOW}📝 Changes in this release:${NC}"
git log --oneline -5
echo ""

# Install dependencies
echo -e "${YELLOW}📚 Installing dependencies...${NC}"
npm install --production || { echo -e "${RED}❌ npm install failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Run database migration
echo -e "${YELLOW}🗄️  Running database migration...${NC}"
echo "⚠️  This will update the database schema for satisfaction surveys"
read -p "Continue with database migration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db push || { echo -e "${RED}❌ Database migration failed${NC}"; exit 1; }
    echo -e "${GREEN}✓ Database migration complete${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping database migration${NC}"
fi
echo ""

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build || { echo -e "${RED}❌ Build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Restart PM2
echo -e "${YELLOW}🔄 Restarting application with PM2...${NC}"
pm2 restart "$PM2_APP_NAME" || { echo -e "${RED}❌ PM2 restart failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Application restarted${NC}"
echo ""

# Wait a few seconds for app to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check PM2 status
echo -e "${YELLOW}📊 Checking application status...${NC}"
pm2 status "$PM2_APP_NAME"
echo ""

# Show recent logs
echo -e "${YELLOW}📋 Recent application logs:${NC}"
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
echo ""

# Deployment summary
echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "📦 Deployed Version: $RELEASE_TAG"
echo "🕐 Deployment Time: $(date)"
echo ""
echo "🧪 Next Steps - Test These Features:"
echo "  1. Satisfaction Survey - Reply to ticket and check email"
echo "  2. Sticky Sidebars - Open ticket and scroll"
echo "  3. Auto-refresh - Add comment and watch it appear"
echo "  4. Blocked Senders - Test in Admin panel"
echo ""
echo "📊 Useful Commands:"
echo "  pm2 status         - Check app status"
echo "  pm2 logs $PM2_APP_NAME   - View logs"
echo "  pm2 restart $PM2_APP_NAME - Restart app"
echo ""
echo "🔄 To rollback if needed:"
echo "  git checkout \$(cat .deployment-backup | cut -d: -f2)"
echo "  npm install && npm run build"
echo "  pm2 restart $PM2_APP_NAME"
echo ""
echo "=========================================="
