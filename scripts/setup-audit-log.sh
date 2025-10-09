#!/bin/bash

# AIDIN Audit Log Setup Script
# Sets up the production-grade audit log system

set -e

echo "🔒 Setting up AIDIN Audit Log System..."
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

echo "📦 Step 1: Running database migration..."
npx prisma migrate deploy

echo ""
echo "🔄 Step 2: Generating Prisma client..."
npx prisma generate

echo ""
echo "🌱 Step 3: Seeding example audit events..."
npx ts-node prisma/seeds/audit-log-seed.ts

echo ""
echo "✅ Audit log system setup complete!"
echo ""
echo "📍 Next steps:"
echo "  1. Access admin UI: http://localhost:3000/admin/audit"
echo "  2. Review integration guide: docs/AUDIT_INTEGRATION_GUIDE.md"
echo "  3. Add logEvent() calls to your handlers"
echo "  4. Set up hourly verification job (see docs/AUDIT_LOG.md)"
echo ""
echo "📚 Documentation:"
echo "  - Full reference: docs/AUDIT_LOG.md"
echo "  - Integration guide: docs/AUDIT_INTEGRATION_GUIDE.md"
echo "  - Summary: docs/AUDIT_LOG_SUMMARY.md"
echo ""
