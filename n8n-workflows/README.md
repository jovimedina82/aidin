# N8N Helpdesk Automation Workflows

This directory contains N8N workflow configurations for automating your helpdesk system.

## 🚀 Quick Setup

### 1. Access N8N
Open your browser and go to: **http://localhost:5678**

**Login Credentials:**
- Username: `admin`
- Password: `helpdesk123`

### 2. Import the Workflow

1. In N8N, click the **"+"** button to create a new workflow
2. Click on the **"..."** menu in the top right
3. Select **"Import from file"**
4. Upload the `helpdesk-automation.json` file from this directory
5. Click **"Save"** to save the workflow

### 3. Configure the Workflow

#### Set up HTTP Basic Auth Credential:
1. Go to **Credentials** in the left sidebar
2. Click **"Add Credential"**
3. Select **"HTTP Basic Auth"**
4. Name it: `helpdesk-api-auth`
5. Set your helpdesk API credentials (use any valid user from your system)

#### Update Node Configurations:
1. Open each HTTP Request node in the workflow
2. Select the `helpdesk-api-auth` credential you just created
3. Update the server URLs if needed (default is `helpdesk-app:3000` for Docker)

### 4. Activate the Workflow

1. Click the **"Active"** toggle in the top right to activate the workflow
2. The webhook URL will be: `http://localhost:5678/webhook/new-ticket`

## 📋 What This Workflow Does

### 🎯 **Ticket Auto-Assignment**
- Automatically assigns tickets based on category and department
- Uses round-robin logic for load balancing
- Updates ticket status from NEW to OPEN when assigned

### 🔥 **High Priority Alerts**
- Sends immediate email notifications for HIGH priority tickets
- Customizable alert recipients and message templates

### 📚 **Knowledge Base Integration**
- Searches for relevant KB articles when tickets are created
- Automatically adds KB suggestions as comments to tickets
- Helps reduce resolution time with existing solutions

### 🔄 **Workflow Steps**
1. **Webhook Trigger** - Receives new ticket data from helpdesk
2. **Priority Check** - Identifies high priority tickets
3. **Department Lookup** - Fetches department information
4. **KB Search** - Searches knowledge base for relevant articles
5. **Auto-Assignment** - Assigns ticket to appropriate staff member
6. **Notifications** - Sends alerts and adds KB suggestions
7. **Response** - Confirms successful processing

## 🧪 Testing the Integration

### Test the webhook manually:
```bash
# Test the N8N webhook endpoint
curl -X GET http://localhost:3000/api/test/n8n-webhook
```

### Create a test ticket:
1. Go to your helpdesk dashboard
2. Create a new ticket with HIGH priority
3. Check N8N execution log to see the workflow in action
4. Verify the ticket gets auto-assigned and KB suggestions are added

## ⚙️ Customization

### Modify Auto-Assignment Rules:
Edit the "Auto-assign Logic" node to customize assignment based on:
- Department
- Category
- Priority
- Time of day
- Staff availability

### Add More Triggers:
- Ticket status changes
- Comment additions
- Overdue ticket alerts
- Customer satisfaction surveys

### Integration Options:
- Email notifications (SMTP)
- Slack/Teams alerts
- SMS notifications
- External CRM systems
- Monitoring tools

## 🔧 Troubleshooting

### Common Issues:

1. **Webhook not triggering:**
   - Ensure N8N is running on port 5678
   - Check that the workflow is active
   - Verify webhook URL in helpdesk code

2. **Authentication errors:**
   - Set up HTTP Basic Auth credentials
   - Use valid helpdesk user credentials
   - Check API endpoints are accessible

3. **Assignment not working:**
   - Update user IDs in the auto-assignment logic
   - Verify department and user data
   - Check console logs for errors

### Debug Mode:
Enable debug logging in N8N by setting:
```bash
N8N_LOG_LEVEL=debug
```

## 📊 Monitoring

View workflow executions in N8N:
1. Go to **Executions** in the left sidebar
2. Monitor success/failure rates
3. Check execution logs for troubleshooting
4. Set up error notifications for failed workflows

## 🔐 Security Notes

- Change default N8N credentials in production
- Use environment variables for sensitive data
- Implement proper authentication for webhooks
- Monitor workflow execution logs for security issues

## 📈 Performance Tips

- Limit webhook payload size
- Use async processing for non-critical tasks
- Implement error handling and retries
- Monitor execution times and optimize bottlenecks