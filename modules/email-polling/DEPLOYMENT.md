# Email Polling Module - Deployment Guide

## 🎯 Overview

This guide walks you through deploying the native Email Polling Service to replace N8N workflow automation.

---

## ✅ Pre-Deployment Checklist

Before enabling the email polling service, ensure:

- [x] N8N workflow is **STOPPED** (to prevent duplicate processing)
- [x] `EMAIL_SENDING_DISABLED=true` is **REMOVED** from `.env.local` (re-enable email sending)
- [x] Microsoft Graph API credentials are configured
- [x] OpenAI API key is configured (for classification)
- [x] Server is running without errors

---

## 📋 Step-by-Step Deployment

### Step 1: Remove Emergency Kill Switch

The kill switch was added to stop the email loop. Now remove it:

**Edit `.env.local`:**
```env
# REMOVE or comment out these lines:
# EMAIL_SENDING_DISABLED=true
# EMAIL_PROVIDER=disabled
```

**Restore original values:**
```env
EMAIL_PROVIDER=smtp  # or your original value
```

---

### Step 2: Enable Email Polling (Disabled by Default)

**Edit `.env.local`:**
```env
EMAIL_POLLING_ENABLED=true  # Change from false to true
```

**Other settings (already configured):**
```env
EMAIL_POLLING_INTERVAL_MS=60000              # Poll every 1 minute
EMAIL_POLLING_BATCH_SIZE=10                  # Max 10 emails per poll
EMAIL_AUTO_MARK_READ=true                    # Auto-mark as read
EMAIL_CLASSIFICATION_ENABLED=true            # Use AI
```

---

### Step 3: Restart Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

**Expected console output:**
```
🚀 Initializing server components...
⏸️  Azure AD sync scheduler disabled (not in production or manually disabled)
🧹 Starting attachment cleanup scheduler...
🔒 Starting audit log cleanup scheduler...
📬 Starting email polling service...
📬 Starting email polling service (every 60 seconds)...
✅ Email polling started
✅ Ready in 2s
```

---

### Step 4: Verify Email Polling is Running

**Check Status API:**
```bash
curl http://localhost:3000/api/jobs/email-polling/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq
```

**Expected Response:**
```json
{
  "isRunning": true,
  "interval": 60000,
  "stats": {
    "total": 0,
    "success": 0,
    "failed": 0,
    "support": 0,
    "vendor": 0,
    "unclear": 0,
    "lastPoll": null,
    "lastSuccess": null
  }
}
```

---

### Step 5: Test with Single Email

**Send a test email to `helpdesk@surterreproperties.com`:**

```
From: test@surterreproperties.com
To: helpdesk@surterreproperties.com
Subject: Test - Printer not working
Body: My printer won't print. Please help!
```

**Watch server logs:**
```bash
tail -f logs/server.log  # or check terminal output
```

**Expected Log Output:**
```
📬 Polling inbox for unread emails (batch size: 10)...
📧 Found 1 unread email(s)
📧 Processing new email from test@surterreproperties.com: Test - Printer not working
🤖 Classification: support (confidence: 0.95, method: ai)
✅ Ticket created: IT000007 (support, confidence: 0.95)
✅ Email marked as read: AAMkAD...
✅ Polling complete: 1 processed, 0 failed
```

**Verify Ticket Created:**
```bash
curl http://localhost:3000/api/tickets?limit=1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.tickets[0]'
```

---

### Step 6: Test Reply Handling

**Reply to the ticket email:**

```
From: test@surterreproperties.com
To: helpdesk@surterreproperties.com
Subject: RE: Test - Printer not working [Ticket #IT000007]
Body: Never mind, I fixed it!
```

**Expected Log Output:**
```
📬 Polling inbox for unread emails (batch size: 10)...
📧 Found 1 unread email(s)
📧 Processing reply for ticket IT000007 from test@surterreproperties.com
✅ Reply processed for ticket IT000007
✅ Email marked as read: AAMkAD...
✅ Polling complete: 1 processed, 0 failed
```

**Verify Reply Added:**
```bash
curl http://localhost:3000/api/tickets/IT000007/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.messages[-1]'
```

---

### Step 7: Monitor for 24 Hours

**Watch for issues:**
- Duplicate tickets (shouldn't happen)
- Failed processing (check DLQ)
- Classification accuracy
- Performance (poll duration)

**Check DLQ for errors:**
```sql
SELECT * FROM email_dlq ORDER BY created_at DESC LIMIT 10;
```

**Check Stats:**
```bash
curl http://localhost:3000/api/jobs/email-polling/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🛠️ Manual Controls

### Start Polling
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Stop Polling
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Trigger Immediate Poll
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🚨 Emergency Rollback

If something goes wrong:

### Option 1: Stop Polling
```env
# .env.local
EMAIL_POLLING_ENABLED=false
```

Restart server.

### Option 2: Re-enable N8N
1. Stop native polling (Option 1)
2. Activate N8N workflow
3. Investigate issue
4. Fix and re-deploy

---

## 📊 Performance Tuning

### High Volume (100+ emails/day)

```env
EMAIL_POLLING_INTERVAL_MS=30000   # Poll every 30s
EMAIL_POLLING_BATCH_SIZE=20       # Process 20 per poll
```

### Low Volume (10-20 emails/day)

```env
EMAIL_POLLING_INTERVAL_MS=300000  # Poll every 5 minutes
EMAIL_POLLING_BATCH_SIZE=5        # Process 5 per poll
```

---

## ✅ Post-Deployment Verification

After 1 week of successful operation:

- [ ] No duplicate tickets created
- [ ] All replies properly threaded
- [ ] Classification accuracy >90%
- [ ] No emails stuck unread
- [ ] DLQ has <5% of total emails
- [ ] Poll duration <10 seconds

**If all checks pass:**
- Archive N8N workflow JSON files
- Remove N8N Docker container
- Update documentation
- Celebrate! 🎉

---

## 🐛 Troubleshooting

### Issue: Polling not starting

**Check:**
```bash
grep EMAIL_POLLING_ENABLED .env.local
# Should show: EMAIL_POLLING_ENABLED=true
```

**Check logs:**
```
Should see: "📬 Starting email polling service..."
Should NOT see: "⏸️  Email polling disabled"
```

### Issue: Classification always returns "unclear"

**Test OpenAI API:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Fallback to heuristics:**
```env
EMAIL_CLASSIFICATION_ENABLED=false  # Use heuristics only
```

### Issue: Emails not being marked as read

**Check setting:**
```env
EMAIL_AUTO_MARK_READ=true  # Should be true
```

**Check permissions:**
- Microsoft Graph API needs `Mail.ReadWrite` permission
- Admin consent granted

### Issue: Duplicate tickets

**Cause:** Both N8N and native polling running

**Fix:**
```bash
# Stop N8N immediately
docker stop n8n  # or however you run it

# OR disable native polling
EMAIL_POLLING_ENABLED=false
```

---

## 📝 Deployment Log Template

Use this to track deployment:

```
Date: ____________________
Deployed by: ____________________
Environment: ____________________

Pre-Deployment:
- [ ] N8N stopped
- [ ] Kill switch removed
- [ ] Credentials verified

Deployment:
- [ ] EMAIL_POLLING_ENABLED=true
- [ ] Server restarted
- [ ] Status API verified

Testing:
- [ ] Test email sent at: ____________________
- [ ] Ticket created: ____________________
- [ ] Reply tested at: ____________________
- [ ] Reply threaded correctly: Yes / No

Monitoring (24h):
- [ ] No duplicates found
- [ ] No errors in DLQ
- [ ] Classification accuracy: ____%
- [ ] Average poll duration: ____s

Notes:
____________________________________________________
____________________________________________________
____________________________________________________
```

---

## 🎓 Training

**For IT Team:**
- Email polling runs automatically every 1 minute
- No N8N login needed
- All controls via API or admin dashboard
- Check status: `/api/jobs/email-polling/status`

**For End Users:**
- No changes to email workflow
- Continue sending to `helpdesk@surterreproperties.com`
- Ticket numbers in subject for threading
- Faster response (no N8N overhead)

---

## 📞 Support

For issues during deployment:
1. Check server logs
2. Check DLQ table
3. Test with status API
4. Review troubleshooting section
5. If still stuck, check GitHub issues or contact admin

---

**Good luck with deployment! 🚀**
