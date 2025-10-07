#!/bin/bash

# Update all n8n workflow URLs from localhost/docker to production
# This fixes workflows imported from local development

N8N_DB="/var/lib/docker/volumes/aidin_n8n_data/_data/database.sqlite"

echo "🔧 Updating n8n workflow URLs to production..."
echo ""

# Backup database first
echo "📦 Creating backup..."
cp "$N8N_DB" "$N8N_DB.backup-$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup created"
echo ""

# Stop n8n to safely modify database
echo "🛑 Stopping n8n..."
docker stop aidin-n8n-1 > /dev/null 2>&1
echo "✅ n8n stopped"
echo ""

echo "🔄 Updating URLs in workflows..."
echo ""

# Get all workflows
WORKFLOW_IDS=$(sqlite3 "$N8N_DB" "SELECT id FROM workflow_entity;")

for ID in $WORKFLOW_IDS; do
    # Get the workflow nodes
    NODES=$(sqlite3 "$N8N_DB" "SELECT nodes FROM workflow_entity WHERE id='$ID';")

    # Update various URL patterns
    UPDATED_NODES=$(echo "$NODES" | sed \
        -e 's|http://localhost:3000|https://helpdesk.surterreproperties.com|g' \
        -e 's|http://host\.docker\.internal:3000|https://helpdesk.surterreproperties.com|g' \
        -e 's|http://helpdesk-app:3000|https://helpdesk.surterreproperties.com|g' \
        -e 's|\"localhost:3000\"|\"helpdesk.surterreproperties.com\"|g')

    # Check if anything changed
    if [ "$NODES" != "$UPDATED_NODES" ]; then
        # Escape for SQL
        ESCAPED_NODES=$(echo "$UPDATED_NODES" | sed "s/'/''/g")

        # Update the workflow
        sqlite3 "$N8N_DB" "UPDATE workflow_entity SET nodes='$ESCAPED_NODES' WHERE id='$ID';"

        # Get workflow name
        WORKFLOW_NAME=$(sqlite3 "$N8N_DB" "SELECT name FROM workflow_entity WHERE id='$ID';")
        echo "  ✅ Updated: $WORKFLOW_NAME"
    fi
done

echo ""
echo "🚀 Starting n8n..."
docker start aidin-n8n-1 > /dev/null 2>&1

echo "⏳ Waiting for n8n to start..."
sleep 8

echo ""
echo "✅ All workflows updated!"
echo ""
echo "🌐 Access n8n at: https://n8n.surterreproperties.com"
echo ""
echo "📋 Changes made:"
echo "  - http://localhost:3000 → https://helpdesk.surterreproperties.com"
echo "  - http://host.docker.internal:3000 → https://helpdesk.surterreproperties.com"
echo "  - http://helpdesk-app:3000 → https://helpdesk.surterreproperties.com"
