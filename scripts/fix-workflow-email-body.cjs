#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const workflowPath = '/opt/apps/aidin/n8n-workflows/Email to Ticket - With Forward(1).json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// Find the "Extract Messages" node
const extractMessagesNode = workflow.nodes.find(n => n.name === 'Extract Messages');
if (!extractMessagesNode) {
  console.error('❌ Could not find "Extract Messages" node');
  process.exit(1);
}

// Add new "Get Full Email Body" node after "Extract Messages"
const newNode = {
  "parameters": {
    "url": "=https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/messages/{{ $json.id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $('Get Access Token').first().json.access_token }}"
        }
      ]
    },
    "options": {}
  },
  "id": "get-full-body-node-" + Date.now(),
  "name": "Get Full Email Body",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [
    extractMessagesNode.position[0] + 200,
    extractMessagesNode.position[1]
  ]
};

// Add the new node to the workflow
workflow.nodes.push(newNode);

// Update "Build AI Request" node to use full body
const buildAIRequestNode = workflow.nodes.find(n => n.name === 'Build AI Request');
if (buildAIRequestNode) {
  buildAIRequestNode.parameters.jsCode = buildAIRequestNode.parameters.jsCode
    .replace(
      /const BODY\s*=\s*String\(email\.bodyPreview \|\| ''\)\.slice\(0, 4000\);/g,
      "const BODY = String(email.body?.content || email.bodyPreview || '').slice(0, 4000);"
    );
}

// Update "Build Ticket Payload" node to use full body
const buildTicketPayloadNode = workflow.nodes.find(n => n.name === 'Build Ticket Payload');
if (buildTicketPayloadNode) {
  buildTicketPayloadNode.parameters.jsCode = buildTicketPayloadNode.parameters.jsCode
    .replace(
      /const description = \(email\.bodyPreview \?\? ''\)\.toString\(\)\.slice\(0, 5000\);/g,
      "const description = (email.body?.content ?? email.bodyPreview ?? '').toString().slice(0, 5000);"
    );
}

// Update connections: Extract Messages -> Get Full Email Body -> Loop Over Items
const extractMessagesId = extractMessagesNode.id || extractMessagesNode.name;
const newNodeId = newNode.id || newNode.name;

// Update Extract Messages connection
if (workflow.connections['Extract Messages']) {
  workflow.connections['Get Full Email Body'] = {
    "main": workflow.connections['Extract Messages'].main
  };
  workflow.connections['Extract Messages'] = {
    "main": [
      [
        {
          "node": "Get Full Email Body",
          "type": "main",
          "index": 0
        }
      ]
    ]
  };
}

// Save the updated workflow
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

console.log('✅ Workflow updated successfully!');
console.log('📝 Changes made:');
console.log('   1. Added "Get Full Email Body" node to fetch complete email content');
console.log('   2. Updated "Build AI Request" to use full body instead of preview');
console.log('   3. Updated "Build Ticket Payload" to use full body instead of preview');
console.log('   4. Updated workflow connections');
console.log('');
console.log('🔄 Run the import script to update n8n:');
console.log('   /opt/apps/aidin/scripts/import-n8n-workflows.sh');
