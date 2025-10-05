# 📧 Email-to-Ticket AI Classifier Setup Guide

## 🎯 What This Workflow Does

This n8n workflow automatically:
1. **Monitors** helpdesk@surterreproperties.com inbox
2. **Classifies** emails using OpenAI (GPT-4):
   - ✅ **Support Request** → Creates ticket
   - ❌ **Vendor Email** → Ignores
   - ⚠️ **Uncertain** → Flags for admin review
3. **Searches** knowledge base for solutions
4. **Creates** support tickets automatically
5. **Sends** auto-reply with possible solutions or ticket confirmation

---

## 🚀 Quick Setup (30 minutes)

### Step 1: Start n8n

```bash
# Start n8n with Docker
docker-compose up -d n8n

# Access n8n at:
http://localhost:5678

# Login credentials:
Username: admin
Password: helpdesk123
```

### Step 2: Configure Credentials

#### A. Microsoft Graph Email OAuth2

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Microsoft Graph Email OAuth2 API**
3. Fill in:
   - **Client ID**: (from your .env.local NEXT_PUBLIC_AZURE_AD_CLIENT_ID)
   - **Client Secret**: (from your .env.local AZURE_AD_CLIENT_SECRET)
   - **Tenant ID**: (from your .env.local NEXT_PUBLIC_AZURE_AD_TENANT_ID)
4. Click **Connect my account**
5. Login with helpdesk@surterreproperties.com
6. Save as: **"Microsoft Graph Email - helpdesk@surterreproperties.com"**

#### B. OpenAI API

1. Go to **Credentials** → **Add Credential**
2. Search for **OpenAI API**
3. Fill in:
   - **API Key**: (from your .env.local OPENAI_API_KEY)
4. Save as: **"OpenAI - Helpdesk"**

#### C. Helpdesk API Basic Auth

1. Go to **Credentials** → **Add Credential**
2. Search for **HTTP Basic Auth**
3. Fill in:
   - **Username**: Any admin email from your helpdesk (e.g., admin@surterreproperties.com)
   - **Password**: The password for that admin account
4. Save as: **"Helpdesk API Auth"**

### Step 3: Import Workflow

1. In n8n, click **"+" → Import from file**
2. Select: `n8n-workflows/email-to-ticket-ai-classifier.json`
3. Click **Import**

### Step 4: Configure Workflow Nodes

#### Update these nodes with your credentials:

1. **Monitor Helpdesk Email** node:
   - Select credential: "Microsoft Graph Email - helpdesk@surterreproperties.com"

2. **AI Email Classifier** node:
   - Select credential: "OpenAI - Helpdesk"

3. **Search Knowledge Base** node:
   - Select credential: "Helpdesk API Auth"
   - Update URL if not using Docker: `http://localhost:3000/api/admin/knowledge-base`

4. **Create Support Ticket** node:
   - Select credential: "Helpdesk API Auth"
   - Update URL if not using Docker: `http://localhost:3000/api/tickets`

5. **Send Auto-Reply Email** node:
   - Select credential: "Microsoft Graph Email - helpdesk@surterreproperties.com"

6. **Notify Admin - Uncertain** node:
   - Select credential: "Helpdesk API Auth"
   - Update URL if not using Docker: `http://localhost:3000/api/admin/notifications`

### Step 5: Activate the Workflow

1. Click **Save** (top right)
2. Toggle **Active** switch to ON
3. The workflow will now monitor emails every minute

---

## 🧪 Testing the Workflow

### Test 1: Send a Real Support Request

Send an email to **helpdesk@surterreproperties.com**:

```
From: maria@surterreproperties.com
Subject: Can't connect to WiFi
Body: Hi, I'm having trouble connecting to the office WiFi. My laptop won't authenticate. Can you help?
```

**Expected Result:**
- ✅ AI classifies as SUPPORT_REQUEST
- ✅ Ticket created in helpdesk
- ✅ Auto-reply sent with ticket number
- ✅ KB article suggested if available

### Test 2: Send a Vendor Email

Send an email to **helpdesk@surterreproperties.com**:

```
From: no-reply@adobe.com
Subject: Confirm your Adobe subscription
Body: Please verify your email address to complete your Adobe Creative Cloud subscription.
```

**Expected Result:**
- ❌ AI classifies as VENDOR_EMAIL
- ❌ No ticket created
- ❌ Email ignored silently

### Test 3: Send an Uncertain Email

Send an email to **helpdesk@surterreproperties.com**:

```
From: unknown@gmail.com
Subject: Question
Body: Hi
```

**Expected Result:**
- ⚠️ AI classifies as UNCERTAIN
- ⚠️ Admin notification sent
- ⚠️ No ticket created automatically

### View Results

1. Go to n8n → **Executions** (left sidebar)
2. Check execution logs for each test
3. Verify tickets in helpdesk at http://localhost:3000/dashboard

---

## 🔧 Configuration Options

### Email Polling Frequency

Default: Every minute

To change:
1. Edit **"Monitor Helpdesk Email"** node
2. Update **Poll Times** → **Every Minute** to your preference

### AI Classification Tuning

Edit **"AI Email Classifier"** node → System message to adjust:
- Confidence threshold
- Classification categories
- Extraction rules

Example improvements:
```json
"If sender domain is @surterreproperties.com → 95% chance SUPPORT_REQUEST"
"If subject contains 'unsubscribe' → 99% chance VENDOR_EMAIL"
```

### Auto-Reply Customization

Edit **"Send Auto-Reply Email"** node → Message to customize:
- Email template design
- Company branding
- Contact information

---

## 📊 Workflow Logic Flow

```
Incoming Email
    ↓
[Monitor Helpdesk Email] - Checks inbox every minute
    ↓
[AI Email Classifier] - OpenAI GPT-4 analyzes email
    ↓
[Process AI Classification] - Parse JSON response
    ↓
[Classification Router] - Decision point
    ├─ SUPPORT_REQUEST → [Search Knowledge Base]
    │                        ↓
    │                   [Create Support Ticket]
    │                        ↓
    │                   [Prepare Auto-Reply]
    │                        ↓
    │                   [Send Auto-Reply Email]
    │                        ↓
    │                   [Log Processing Activity]
    │
    ├─ VENDOR_EMAIL → [Ignore Vendor Email]
    │                     ↓
    │                 [Log Processing Activity]
    │
    └─ UNCERTAIN → [Notify Admin - Uncertain]
                       ↓
                   [Log Processing Activity]
```

---

## 🔐 Security Considerations

1. **Credential Storage**: All credentials are encrypted in n8n
2. **Email Access**: Uses OAuth2 (more secure than IMAP/password)
3. **API Authentication**: Basic Auth required for helpdesk API calls
4. **Data Privacy**: Emails processed locally, only OpenAI sees content for classification

### Production Checklist:
- [ ] Change n8n admin password
- [ ] Use environment variables for secrets
- [ ] Enable HTTPS for n8n
- [ ] Restrict n8n network access
- [ ] Set up error notifications
- [ ] Enable n8n logging

---

## 🐛 Troubleshooting

### Workflow Not Triggering

**Problem**: Emails arrive but workflow doesn't run

**Solutions**:
1. Check workflow is **Active** (toggle ON)
2. Verify Microsoft Graph credentials are connected
3. Check execution logs for errors
4. Ensure helpdesk email has permissions

### AI Classification Errors

**Problem**: All emails classified as UNCERTAIN

**Solutions**:
1. Verify OpenAI API key is valid
2. Check OpenAI API quota/billing
3. Review AI classifier node configuration
4. Increase confidence threshold in prompt

### Tickets Not Created

**Problem**: Emails classified correctly but no tickets

**Solutions**:
1. Check helpdesk API credentials
2. Verify helpdesk app is running on port 3000
3. Check Docker network (use `helpdesk-app:3000` in Docker)
4. Review helpdesk API logs for errors

### Auto-Reply Not Sending

**Problem**: Tickets created but no reply sent

**Solutions**:
1. Verify Microsoft Graph send permission
2. Check email node credentials
3. Ensure helpdesk email has Send As permission
4. Review n8n execution logs

### Common Errors:

#### "Access token expired"
- Reconnect Microsoft Graph OAuth2 credential
- Reauthenticate with helpdesk email

#### "OpenAI rate limit exceeded"
- Upgrade OpenAI plan or reduce polling frequency
- Add retry logic with delays

#### "Cannot connect to helpdesk-app:3000"
- Check if helpdesk app is running
- Use `http://localhost:3000` if not using Docker
- Verify Docker network configuration

---

## 📈 Monitoring & Analytics

### View Execution History

1. Go to **Executions** in n8n
2. Filter by:
   - Success/Failure
   - Date range
   - Workflow name

### Classification Statistics

Track in execution logs:
- Total emails processed
- Support requests vs vendor emails
- Uncertain classifications
- Tickets created
- Knowledge base matches

### Performance Metrics

Monitor:
- Average processing time per email
- OpenAI API response time
- Knowledge base search speed
- Ticket creation success rate

---

## 🔄 Maintenance

### Weekly Tasks:
- [ ] Review uncertain email classifications
- [ ] Check for failed executions
- [ ] Monitor OpenAI API usage/costs
- [ ] Review auto-reply effectiveness

### Monthly Tasks:
- [ ] Tune AI classification prompts
- [ ] Update knowledge base for better matches
- [ ] Review and archive old execution logs
- [ ] Check email storage/quota

### As Needed:
- [ ] Add new email classification categories
- [ ] Enhance auto-reply templates
- [ ] Integrate with additional services
- [ ] Scale n8n workers if needed

---

## 🚀 Advanced Features

### 1. Multiple Email Addresses

Monitor additional mailboxes:
1. Duplicate "Monitor Helpdesk Email" node
2. Configure with different email credentials
3. Merge into same classification flow

### 2. Priority Escalation

Add nodes to:
- Detect urgent keywords
- Auto-assign to on-call staff
- Send SMS/Slack alerts for critical issues

### 3. Multi-Language Support

Enhance AI classifier to:
- Detect email language
- Translate if needed
- Respond in user's language

### 4. Learning System

Track AI accuracy:
- Log manual corrections
- Feed back to improve prompts
- Build sender whitelist/blacklist

---

## 📞 Support

Need help?
- **n8n Docs**: https://docs.n8n.io
- **Community Forum**: https://community.n8n.io
- **GitHub Issues**: Report bugs for this workflow

---

## ✅ Setup Checklist

- [ ] n8n running on port 5678
- [ ] Microsoft Graph OAuth2 configured
- [ ] OpenAI API credential added
- [ ] Helpdesk API auth configured
- [ ] Workflow imported successfully
- [ ] All nodes have credentials selected
- [ ] Workflow activated
- [ ] Test email sent (support request)
- [ ] Test email sent (vendor email)
- [ ] Auto-reply received
- [ ] Ticket created in helpdesk
- [ ] Admin notification working

**🎉 You're all set!** Emails to helpdesk@surterreproperties.com will now be automatically classified and processed.
