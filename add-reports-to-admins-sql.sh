#!/bin/bash

# Get database connection details from .env
source .env

echo "🔍 Finding Reports module..."

# Get Reports module ID
REPORTS_MODULE_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM modules WHERE name = 'Reports';" | xargs)

if [ -z "$REPORTS_MODULE_ID" ]; then
  echo "❌ Reports module not found"
  exit 1
fi

echo "✅ Found Reports module (ID: $REPORTS_MODULE_ID)"

echo ""
echo "🔍 Finding admin users..."

# Get all admin user IDs
ADMIN_USERS=$(psql "$DATABASE_URL" -t -c "SELECT id, email, name FROM users WHERE role = 'ADMIN';" | grep -v '^$')

if [ -z "$ADMIN_USERS" ]; then
  echo "❌ No admin users found"
  exit 1
fi

ADMIN_COUNT=$(echo "$ADMIN_USERS" | wc -l)
echo "✅ Found $ADMIN_COUNT admin users"
echo ""

ADDED=0
SKIPPED=0

# Process each admin user
while IFS='|' read -r USER_ID EMAIL NAME; do
  USER_ID=$(echo $USER_ID | xargs)
  EMAIL=$(echo $EMAIL | xargs)
  NAME=$(echo $NAME | xargs)
  
  # Check if user already has Reports access
  EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM user_modules WHERE user_id = '$USER_ID' AND module_id = '$REPORTS_MODULE_ID';" | xargs)
  
  if [ "$EXISTS" -gt 0 ]; then
    echo "⏭️  ${NAME:-$EMAIL} - Already has Reports access"
    SKIPPED=$((SKIPPED+1))
  else
    # Add Reports access
    psql "$DATABASE_URL" -c "INSERT INTO user_modules (user_id, module_id, can_view, can_create, can_edit, can_delete) VALUES ('$USER_ID', '$REPORTS_MODULE_ID', true, true, true, true);" > /dev/null
    echo "✅ ${NAME:-$EMAIL} - Added Reports access"
    ADDED=$((ADDED+1))
  fi
done <<< "$ADMIN_USERS"

echo ""
echo "📊 Summary:"
echo "   - Total admins: $ADMIN_COUNT"
echo "   - Added access: $ADDED"
echo "   - Already had access: $SKIPPED"
echo ""
echo "✅ Done!"
