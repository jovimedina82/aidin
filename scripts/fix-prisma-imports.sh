#!/bin/bash

# Fix Prisma Client instantiation in API routes
# Replace new PrismaClient() with singleton import

files=(
  "app/api/debug/attachments/[ticketNumber]/route.ts"
  "app/api/debug/ticket/[ticketNumber]/route.ts"
  "app/api/tickets/[id]/message-assets/route.ts"
  "app/api/keywords/suggestions/route.js"
  "app/api/inbound/email-images/route.ts"
  "app/api/admin/audit/verify/route.ts"
  "app/api/assets/[id]/route.ts"
  "app/api/admin/audit/actions/route.ts"
  "app/api/admin/audit/export/route.ts"
  "app/api/admin/audit/route.ts"
  "app/api/categories/analytics/route.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Check if file contains new PrismaClient()
    if grep -q "new PrismaClient()" "$file"; then
      # Replace import statement and remove const prisma = new PrismaClient()
      sed -i 's/import { PrismaClient } from.*prisma.*/import { prisma } from '\''@\/lib\/prisma'\'';/g' "$file"
      sed -i '/^const prisma = new PrismaClient()/d' "$file"
      echo "  ✓ Fixed $file"
    else
      echo "  - Skipped $file (no new PrismaClient() found)"
    fi
  else
    echo "  ! File not found: $file"
  fi
done

echo "Done!"
