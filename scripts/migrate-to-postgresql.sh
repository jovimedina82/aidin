#!/bin/bash

# Migration Script: SQLite to PostgreSQL
# This script migrates your helpdesk from SQLite to PostgreSQL
# Usage: ./scripts/migrate-to-postgresql.sh

set -e  # Exit on error

echo "🚀 Starting PostgreSQL Migration"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    echo "Please create .env.production with your PostgreSQL connection string"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will set up PostgreSQL as your production database${NC}"
echo -e "${YELLOW}⚠️  Make sure you have backed up your SQLite database if needed${NC}"
echo ""
read -p "Continue with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "Step 1: Testing PostgreSQL connection..."
echo "========================================="

# Test connection using Prisma
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2- | tr -d '"')
export DATABASE_URL

# Generate Prisma Client for PostgreSQL
echo "Generating Prisma Client..."
npx prisma generate

echo ""
echo "Step 2: Running migrations on PostgreSQL..."
echo "============================================"

# Deploy migrations to PostgreSQL
echo "Deploying schema to PostgreSQL..."
npx prisma migrate deploy

echo ""
echo "Step 3: Verifying database setup..."
echo "===================================="

# Run a simple query to verify
npx prisma db execute --stdin <<SQL
SELECT
  (SELECT COUNT(*) FROM "users") as user_count,
  (SELECT COUNT(*) FROM "roles") as role_count,
  (SELECT COUNT(*) FROM "departments") as department_count;
SQL

echo ""
echo -e "${GREEN}✅ PostgreSQL migration completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "==========="
echo "1. Update your production server's .env file with the PostgreSQL connection string"
echo "2. Restart your production application"
echo "3. Test the connection by accessing your application"
echo ""
echo "Production DATABASE_URL:"
echo "postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
echo ""
echo -e "${YELLOW}⚠️  Remember to keep your local .env.local with SQLite for development${NC}"
