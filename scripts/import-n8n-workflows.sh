#!/bin/bash

# Import n8n workflows into the n8n database
# This script copies workflow JSON files into the n8n SQLite database

set -e

N8N_DATA_DIR="/var/lib/docker/volumes/aidin_n8n_data/_data"
N8N_DB="$N8N_DATA_DIR/database.sqlite"
WORKFLOWS_DIR="/opt/apps/aidin/n8n-workflows"

echo "🔄 Importing n8n workflows..."
echo ""

# Check if database exists
if [ ! -f "$N8N_DB" ]; then
    echo "❌ n8n database not found at $N8N_DB"
    exit 1
fi

# Check if workflows directory exists
if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo "❌ Workflows directory not found at $WORKFLOWS_DIR"
    exit 1
fi

# Function to import a workflow
import_workflow() {
    local workflow_file=$1
    local workflow_name=$(basename "$workflow_file" .json)

    echo "📥 Importing: $workflow_name"

    # Read the workflow JSON
    local workflow_data=$(cat "$workflow_file")

    # Extract workflow name from JSON if available, otherwise use filename
    local name=$(echo "$workflow_data" | jq -r '.name // empty')
    if [ -z "$name" ]; then
        name="$workflow_name"
    fi

    # Extract individual fields from workflow JSON
    local nodes=$(echo "$workflow_data" | jq -c '.nodes // []')
    local connections=$(echo "$workflow_data" | jq -c '.connections // {}')
    local settings=$(echo "$workflow_data" | jq -c '.settings // {}')
    local staticData=$(echo "$workflow_data" | jq -c '.staticData // {}')
    local pinData=$(echo "$workflow_data" | jq -c '.pinData // {}')
    local meta=$(echo "$workflow_data" | jq -c '.meta // {}')

    # Prepare SQL query to insert workflow
    # We'll use a timestamp as the createdAt and updatedAt
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    # Escape single quotes in JSON for SQLite
    local escaped_nodes=$(echo "$nodes" | sed "s/'/''/g")
    local escaped_connections=$(echo "$connections" | sed "s/'/''/g")
    local escaped_settings=$(echo "$settings" | sed "s/'/''/g")
    local escaped_staticData=$(echo "$staticData" | sed "s/'/''/g")
    local escaped_pinData=$(echo "$pinData" | sed "s/'/''/g")
    local escaped_meta=$(echo "$meta" | sed "s/'/''/g")

    # Generate UUID for workflow ID
    local workflow_id=$(cat /proc/sys/kernel/random/uuid)
    local version_id=$(cat /proc/sys/kernel/random/uuid)

    # Insert workflow into database
    sqlite3 "$N8N_DB" <<EOF
INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, staticData, pinData, versionId, triggerCount, meta, isArchived, createdAt, updatedAt)
VALUES (
    '$workflow_id',
    '$name',
    0,
    '$escaped_nodes',
    '$escaped_connections',
    '$escaped_settings',
    '$escaped_staticData',
    '$escaped_pinData',
    '$version_id',
    0,
    '$escaped_meta',
    0,
    '$timestamp',
    '$timestamp'
);
EOF

    if [ $? -eq 0 ]; then
        echo "   ✅ Successfully imported: $name"
    else
        echo "   ❌ Failed to import: $name"
    fi
}

# Import all JSON workflow files
for workflow_file in "$WORKFLOWS_DIR"/*.json; do
    if [ -f "$workflow_file" ]; then
        import_workflow "$workflow_file"
    fi
done

echo ""
echo "📊 Workflow import summary:"
sqlite3 "$N8N_DB" "SELECT COUNT(*) FROM workflow_entity;" | xargs echo "Total workflows:"

echo ""
echo "✅ Import complete!"
echo ""
echo "To view workflows, visit: https://n8n.surterreproperties.com"
echo "Username: admin"
echo "Password: helpdesk123"
