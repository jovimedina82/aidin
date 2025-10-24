#!/bin/bash
set -e

echo "🚀 AIDIN Production Deployment Script"
echo "======================================"

# Configuration
REMOTE_USER="root"
REMOTE_HOST="64.23.144.99"
REMOTE_PATH="/opt/apps/aidin"

echo "📡 Connecting to $REMOTE_HOST..."

ssh $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
cd /opt/apps/aidin

echo "1️⃣  Pulling latest code from git..."
git pull

echo "2️⃣  Installing dependencies..."
npm install --production=false

echo "3️⃣  Generating Prisma client..."
npx prisma generate

echo "4️⃣  Running database migrations..."
npx prisma migrate deploy

echo "5️⃣  Building Next.js application..."
rm -rf .next
NODE_ENV=production npm run build

echo "6️⃣  Creating compatibility files..."
# Create routes-manifest.json for Next.js 14 compatibility
cat > .next/routes-manifest.json << 'EOF'
{
  "version": 3,
  "pages404": true,
  "basePath": "",
  "redirects": [],
  "headers": [],
  "dynamicRoutes": [],
  "staticRoutes": [],
  "dataRoutes": [],
  "i18n": null
}
EOF

echo "7️⃣  Setting correct permissions..."
chown -R www-data:www-data .next
chown -R www-data:www-data lib/generated

echo "8️⃣  Verifying build files..."
if [ ! -f .next/BUILD_ID ]; then
    echo "❌ ERROR: BUILD_ID file missing!"
    exit 1
fi
echo "✓ BUILD_ID: $(cat .next/BUILD_ID)"

if [ ! -f .next/routes-manifest.json ]; then
    echo "❌ ERROR: routes-manifest.json missing!"
    exit 1
fi
echo "✓ routes-manifest.json exists"

if [ ! -d lib/generated/prisma ]; then
    echo "❌ ERROR: Prisma client not generated!"
    exit 1
fi
echo "✓ Prisma client generated"

echo "9️⃣  Restarting service..."
systemctl restart aidin.service

echo "⏳ Waiting for service to start..."
sleep 5

echo "🔍 Checking service status..."
if systemctl is-active --quiet aidin.service; then
    echo "✅ Service is running"
else
    echo "❌ Service failed to start"
    systemctl status aidin.service --no-pager
    exit 1
fi

echo "🧪 Testing application..."
if curl -s http://localhost:3011/login | head -1 | grep -q "<!DOCTYPE html>"; then
    echo "✅ Application is responding"
else
    echo "❌ Application is not responding correctly"
    curl -I http://localhost:3011/login
    exit 1
fi

echo ""
echo "✨ Deployment completed successfully!"
echo "🌐 Site: https://helpdesk.surterreproperties.com"
ENDSSH

echo ""
echo "📊 Final verification from external..."
if curl -s https://helpdesk.surterreproperties.com/login -I | grep -q "HTTP/2 200"; then
    echo "✅ External access confirmed - Site is LIVE!"
else
    echo "⚠️  External check returned non-200 status"
    curl -I https://helpdesk.surterreproperties.com/login | head -5
fi
