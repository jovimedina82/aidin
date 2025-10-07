# n8n Workflows Configuration Guide

## ✅ Workflows Successfully Imported

The following 7 workflows have been imported into your n8n instance:

1. **Email to Ticket - With Forward** - Email forwarding workflow
2. **Email to Ticket - AI Classifier** - AI-powered email classification
3. **Email to Ticket - Simple** (2 variants) - Basic email to ticket conversion
4. **Email to Ticket - IMAP** - IMAP-based email monitoring
5. **Helpdesk Automation** - Main automation workflow
6. **Simple Helpdesk Automation** - Simplified automation

## 🌐 Access n8n

**URL:** https://n8n.surterreproperties.com

**Login Credentials:**
- Username: `admin`
- Password: `helpdesk123`

## 📋 Next Steps to Configure Workflows

### 1. Create HTTP Basic Auth Credential

All workflows that communicate with the helpdesk API need authentication:

1. Click **"Credentials"** in the left sidebar
2. Click **"Add Credential"**
3. Search for and select **"HTTP Basic Auth"**
4. Fill in:
   - **Name:** `helpdesk-api-auth`
   - **User:** Your helpdesk admin email (e.g., `jmedina@surterreproperties.com`)
   - **Password:** Your helpdesk password
5. Click **"Save"**

### 2. Configure Each Workflow

For each workflow you want to use:

#### A. Open the Workflow
1. Click **"Workflows"** in the left sidebar
2. Click on the workflow name to open it

#### B. Update HTTP Request Nodes
For each HTTP Request node in the workflow:

1. Click on the node to open settings
2. In the **"Credential for Basic Auth"** dropdown:
   - Select `helpdesk-api-auth`
3. Update the **URL** field:
   - Change `http://localhost:3000` or `http://helpdesk-app:3000`
   - To: `https://helpdesk.surterreproperties.com`

#### C. Configure Email Credentials (for email workflows)
For email-based workflows, you'll need to add email credentials:

**For IMAP workflows:**
1. Create **"IMAP"** credential
2. Fill in your email server details:
   - **Host:** `outlook.office365.com` (for Office 365)
   - **Port:** `993`
   - **User:** `helpdesk@surterreproperties.com`
   - **Password:** Your email password
   - **Secure:** `true`

**For SMTP (sending emails):**
1. Create **"SMTP"** credential
2. Fill in:
   - **Host:** `smtp.office365.com`
   - **Port:** `587`
   - **User:** `helpdesk@surterreproperties.com`
   - **Password:** Your email password
   - **Secure Connection:** `STARTTLS`

### 3. Configure OpenAI Credential (for AI Classifier workflow)

If using the **Email to Ticket - AI Classifier** workflow:

1. Click **"Credentials"** → **"Add Credential"**
2. Select **"OpenAI"**
3. Fill in:
   - **Name:** `openai-api`
   - **API Key:** Your OpenAI API key
4. Click **"Save"**

Then in the workflow:
1. Find the OpenAI node
2. Select the `openai-api` credential

### 4. Update Webhook URLs

For workflows with webhook triggers:

1. Click on the **"Webhook"** node
2. Note the webhook URL (e.g., `https://n8n.surterreproperties.com/webhook/...`)
3. Update your helpdesk code to use this URL for notifications

### 5. Test the Workflows

#### Test Mode:
1. Click **"Test workflow"** button (top right)
2. For webhook workflows, you can manually trigger with test data
3. Click **"Listen for test event"** on webhook nodes
4. Send a test request or create a test ticket

#### Production Mode:
1. Click **"Save"** to save your changes
2. Toggle **"Active"** switch (top right) to enable the workflow
3. The workflow will now run automatically when triggered

## 🔧 Recommended Workflows to Start With

### 1. Helpdesk Automation (Recommended First)
**Purpose:** Automatically assigns tickets, sends priority alerts, searches KB

**Setup:**
- Configure `helpdesk-api-auth` credential
- Update all HTTP Request URLs to `https://helpdesk.surterreproperties.com`
- Activate the workflow

**Webhook URL:** Configure in your helpdesk app to call this when tickets are created

### 2. Email to Ticket - AI Classifier (Recommended Second)
**Purpose:** Converts emails to tickets with AI classification

**Setup:**
- Configure `helpdesk-api-auth` credential
- Configure IMAP email credential
- Configure OpenAI credential
- Update HTTP Request URLs
- Set polling interval (e.g., every 5 minutes)
- Activate the workflow

### 3. Simple Helpdesk Automation
**Purpose:** Simplified version with basic auto-assignment

**Setup:**
- Same as Helpdesk Automation but with fewer features
- Good for testing before using the full automation

## 📊 Monitoring Workflows

### View Executions:
1. Click **"Executions"** in the left sidebar
2. See all workflow runs, successes, and failures
3. Click on any execution to see detailed logs

### Debug Issues:
1. Enable workflow in Test mode
2. Check execution logs for errors
3. Verify all credentials are configured
4. Ensure URLs are correct

## 🔐 Security Best Practices

1. **Change default password:** Update n8n admin password in production
2. **Use environment variables:** Store sensitive data in Docker environment
3. **Enable HTTPS:** Already configured at https://n8n.surterreproperties.com
4. **Secure webhooks:** Add authentication headers to webhook calls
5. **Regular backups:** Export workflows regularly

## 💡 Tips

- **Start simple:** Activate one workflow at a time
- **Test first:** Use Test mode before activating in production
- **Monitor executions:** Check the Executions tab regularly
- **Error handling:** Add error handling nodes for production workflows
- **Documentation:** Document any customizations you make

## 📞 Support

If you encounter issues:
1. Check the n8n execution logs
2. Verify all credentials are saved correctly
3. Ensure helpdesk API is accessible from n8n container
4. Review workflow node configurations

## 🔄 Workflow Summaries

### Email to Ticket Workflows
- Monitor email inbox
- Parse email content
- Create helpdesk tickets automatically
- Support for IMAP, forwarding, and AI classification

### Helpdesk Automation Workflows
- Auto-assign tickets based on department/category
- Send priority alerts for high-priority tickets
- Search and suggest knowledge base articles
- Update ticket status automatically

Choose the workflows that best fit your needs and activate them!
