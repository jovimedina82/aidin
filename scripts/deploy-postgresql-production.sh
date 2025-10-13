#!/bin/bash

# Production Deployment Script for PostgreSQL Migration
# This script should be run ON THE PRODUCTION SERVER
# Usage: ssh into production server and run this script

set -e  # Exit on error

echo "🚀 PostgreSQL Production Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're on the production server
if [ ! -f "/root/.production-server" ]; then
    echo -e "${RED}❌ This script should only be run on the production server${NC}"
    echo "If this IS the production server, create: touch /root/.production-server"
    exit 1
fi

echo "Step 1: Update .env with PostgreSQL connection"
echo "=============================================="
echo "Please update your .env file with:"
echo ""
echo "DATABASE_URL=\"postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require\""
echo ""
read -p "Have you updated the .env file? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Please update .env first, then run this script again"
    exit 0
fi

echo ""
echo "Step 2: Generate Prisma Client"
echo "==============================="
npx prisma generate

echo ""
echo "Step 3: Deploy Migrations to PostgreSQL"
echo "========================================"
npx prisma migrate deploy

echo ""
echo "Step 4: Rebuild Application"
echo "============================"
npm run build

echo ""
echo "Step 5: Restart Application"
echo "============================"
pm2 restart all

echo ""
echo -e "${GREEN}✅ PostgreSQL deployment completed successfully!${NC}"
echo ""
echo "Verify deployment:"
echo "- Check: https://helpdesk.surterreproperties.com"
echo "- Monitor: pm2 logs"
echo "- Database: Check DigitalOcean dashboard"
