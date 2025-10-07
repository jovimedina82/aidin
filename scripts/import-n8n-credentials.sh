#!/bin/bash

# Import n8n credentials from a backup file
# Usage: ./import-n8n-credentials.sh <credentials-file.json>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <credentials-backup.json>"
    echo ""
    echo "Example:"
    echo "  $0 /tmp/credentials-backup.json"
    exit 1
fi

CREDENTIALS_FILE="$1"

if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ File not found: $CREDENTIALS_FILE"
    exit 1
fi

echo "📥 Importing n8n credentials from: $CREDENTIALS_FILE"
echo ""

# Copy credentials file to container
echo "📤 Copying credentials to n8n container..."
docker cp "$CREDENTIALS_FILE" aidin-n8n-1:/tmp/credentials.json

# Import credentials
echo "📥 Importing credentials..."
docker exec aidin-n8n-1 n8n import:credentials --input=/tmp/credentials.json 2>&1 | \
    grep -v "Permissions 0644" | \
    grep -v "deprecations related" || true

# Clean up
echo "🧹 Cleaning up..."
docker exec aidin-n8n-1 rm /tmp/credentials.json

echo ""
echo "✅ Credentials import complete!"
echo ""
echo "🌐 Access n8n at: https://n8n.surterreproperties.com"
