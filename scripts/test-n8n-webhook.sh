#!/bin/bash

# Test n8n webhook for Ticket Test Generator
# Usage: ./test-n8n-webhook.sh [count]

COUNT=${1:-3}

echo "🎯 Testing n8n Ticket Test Generator webhook"
echo "================================================"
echo ""
echo "Webhook URL: https://n8n.surterreproperties.com/webhook/ticket-test"
echo "Count: $COUNT"
echo ""
echo "Testing..."
echo ""

# Test the webhook
RESPONSE=$(curl -sS -w "\nHTTP_CODE:%{http_code}" "https://n8n.surterreproperties.com/webhook/ticket-test?count=$COUNT")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "Response Code: $HTTP_CODE"
echo ""
echo "Response Body:"
echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Webhook is working!"
else
    echo "❌ Webhook failed or is not active"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Go to https://n8n.surterreproperties.com"
    echo "2. Open the 'Ticket Test Generator' workflow"
    echo "3. Make sure the workflow is ACTIVE (toggle at top right)"
    echo "4. Check that the Webhook node has:"
    echo "   - HTTP Method: GET"
    echo "   - Path: ticket-test"
    echo "5. Save the workflow if you made changes"
    echo "6. Try running this script again"
fi
