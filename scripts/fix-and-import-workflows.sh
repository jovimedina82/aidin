#!/bin/bash

# Fix and import n8n workflows
# This script adds required fields to workflow JSON files and imports them

set -e

WORKFLOWS_DIR="/opt/apps/aidin/n8n-workflows"
TEMP_DIR="/tmp/fixed-workflows"

echo "🔄 Fixing and importing n8n workflows..."
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"

# Function to fix and prepare a workflow
fix_workflow() {
    local input_file=$1
    local filename=$(basename "$input_file")
    local output_file="$TEMP_DIR/$filename"

    echo "🔧 Fixing: $filename"

    # Check if file is a JSON workflow (not markdown)
    if [[ "$filename" != *.json ]]; then
        echo "   ⏭️  Skipping non-JSON file"
        return
    fi

    # Read the JSON and add/update required fields
    jq '. + {active: false}' "$input_file" > "$output_file"

    echo "   ✅ Fixed and saved to temp directory"
}

# Fix all workflow files
for workflow_file in "$WORKFLOWS_DIR"/*.json; do
    if [ -f "$workflow_file" ]; then
        fix_workflow "$workflow_file"
    fi
done

echo ""
echo "📤 Copying fixed workflows to n8n container..."
docker cp "$TEMP_DIR" aidin-n8n-1:/tmp/workflows-fixed

echo ""
echo "📥 Importing workflows into n8n..."
docker exec aidin-n8n-1 n8n import:workflow --separate --input=/tmp/workflows-fixed/ 2>&1 | grep -v "Permissions 0644" | grep -v "deprecations related"

echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"
docker exec aidin-n8n-1 rm -rf /tmp/workflows-fixed

echo ""
echo "✅ Workflow import complete!"
echo ""
echo "📊 To view workflows, visit: https://n8n.surterreproperties.com"
echo "   Username: admin"
echo "   Password: helpdesk123"
