# Email Polling Module

## Overview

The Email Polling Module replaces N8N workflow automation with native email processing. It polls Microsoft 365 mailboxes, classifies emails using AI, creates tickets, handles replies, and manages email read status.

**Version:** 1.0.0
**Status:** Production Ready
**Dependencies:** Microsoft Graph API, OpenAI API

---

## Features

### ✅ Core Functionality
- **Automated Email Polling**: Checks for new emails every 1 minute
- **AI Classification**: Classifies emails as support/vendor/unclear using OpenAI
- **Reply Detection**: Identifies replies vs new tickets using subject line patterns
- **Smart Routing**: Routes to appropriate endpoint based on email type
- **Email Read Management**: Marks emails as read after processing
- **Fallback Strategy**: Multiple retry strategies for reply handling

### ✅ Advanced Features
- **Heuristic Analysis**: Pre-AI filtering for common patterns (OTP, marketing, etc.)
- **Priority Detection**: Assigns ticket priority based on content
- **Batch Processing**: Processes up to 10 emails per poll
- **Error Recovery**: Dead letter queue for failed emails
- **Rate Limiting**: Built-in protection against API limits

### ✅ Monitoring & Control
- **Admin Dashboard**: Real-time status and controls
- **Manual Triggers**: Force immediate poll on demand
- **Health Checks**: Monitor service health via API
- **Audit Logging**: Track all email processing actions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Email Polling Service                    │
│                                                              │
│  ┌────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   Cron     │───▶│  Poll Inbox  │───▶│  Classify   │    │
│  │  (1 min)   │    │  (Graph API) │    │  (OpenAI)   │    │
│  └────────────┘    └──────────────┘    └─────────────┘    │
│                            │                     │          │
│                            ▼                     ▼          │
│                    ┌─────────────┐      ┌──────────────┐  │
│                    │   Reply?    │      │   Support?   │  │
│                    └─────────────┘      └──────────────┘  │
│                            │                     │          │
│         ┌──────────────────┴──────┬──────────────┘         │
│         ▼                          ▼                        │
│  ┌─────────────┐          ┌──────────────┐                │
│  │ Reply API   │          │  Ticket API  │                │
│  └─────────────┘          └──────────────┘                │
│         │                          │                        │
│         └──────────────┬───────────┘                       │
│                        ▼                                    │
│                ┌───────────────┐                           │
│                │  Mark Read    │                           │
│                └───────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

### 1. Environment Variables

Add to `.env.local`:

```env
# Email Polling Configuration
EMAIL_POLLING_ENABLED=true
EMAIL_POLLING_INTERVAL_MS=60000          # Poll every 60 seconds
EMAIL_POLLING_BATCH_SIZE=10              # Process max 10 emails per poll
EMAIL_AUTO_MARK_READ=true                # Auto-mark as read after processing
EMAIL_CLASSIFICATION_ENABLED=true        # Use AI classification

# Classification Thresholds
EMAIL_CLASSIFICATION_MIN_CONFIDENCE=0.7  # Minimum confidence to auto-create ticket
EMAIL_VENDOR_AUTO_ARCHIVE=true           # Auto-archive vendor emails
EMAIL_UNCLEAR_CREATE_TICKET=true         # Create review ticket for unclear emails

# Performance
EMAIL_POLLING_TIMEOUT_MS=30000           # Max time per email
EMAIL_POLLING_MAX_RETRIES=3              # Retry failed emails

# Microsoft Graph (already configured)
AZURE_AD_TENANT_ID=...
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
HELPDESK_EMAIL=helpdesk@surterreproperties.com

# OpenAI (already configured)
OPENAI_API_KEY=...
```

### 2. Dependencies

Already included in `package.json`:
- `@azure/msal-node` - Microsoft authentication
- `openai` - AI classification
- `node-cron` - Scheduled polling

### 3. Database Schema

No additional schema required. Uses existing tables:
- `tickets` - Created tickets
- `ticket_messages` - Reply comments
- `email_ingest` - Email tracking
- `email_dlq` - Failed emails

---

## Usage

### Automatic Start

The email polling service starts automatically when the server starts (via `instrumentation.ts`).

### Manual Control

**Start Polling:**
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Stop Polling:**
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Manual Poll (Immediate):**
```bash
curl -X POST http://localhost:3000/api/jobs/email-polling/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check Status:**
```bash
curl http://localhost:3000/api/jobs/email-polling/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Admin Dashboard

Navigate to: `http://localhost:3000/admin/email-polling`

Features:
- View polling status (running/stopped)
- See last poll time
- View statistics (processed, failed, skipped)
- Manual trigger button
- Recent classifications list
- Configuration panel

---

## Email Classification

### Classification Types

**1. Support Email** (`class: "support"`)
- Creates a ticket in the helpdesk
- Assigns priority based on content
- Sends to requestor's department

**2. Vendor Email** (`class: "vendor"`)
- Archives with "vendor" label
- Does NOT create ticket
- Does NOT forward (prevents loops)

**3. Unclear Email** (`class: "unclear"`)
- Creates ticket with "Review" flag
- Assigned to admin for manual classification
- Low confidence classification

### Heuristic Signals

Pre-AI analysis detects:
- ✅ **No-Reply Addresses**: `no-reply@`, `noreply@`
- ✅ **OTP/Verification**: One-time codes, authentication emails
- ✅ **Marketing**: Newsletters, promotions, sales
- ✅ **Finance**: Invoices, receipts, payments
- ✅ **Bounce Messages**: Delivery failures
- ✅ **Out of Office**: Auto-replies
- ✅ **Meeting Invites**: Calendar events
- ✅ **Monitoring Alerts**: Uptime alerts, incidents
- ✅ **Help Language**: "please help", "I can't", "not working"
- ✅ **IT Topics**: password, login, printer, VPN

### AI Classification Prompt

```
System: Return STRICT JSON only: {
  "class": "support|vendor|unclear",
  "confidence": 0.0-1.0,
  "reason": "...",
  "priority": "low|normal|high"
}

User:
From: user@example.com (company domain)
Domain: example.com
Subject: My printer is broken
Body: I can't print anything...
Heuristics: {...signals...}
```

**Response:**
```json
{
  "class": "support",
  "confidence": 0.95,
  "reason": "Internal user requesting IT support for printer issue",
  "priority": "normal"
}
```

---

## Reply Detection

### Detection Strategy

**1. Subject Line Pattern Matching**
```regex
/\[(?:Ticket )?#?([A-Z]{2,3}\d{6})\]/i
```

Matches:
- `[Ticket #IT000006]`
- `[#IT000006]`
- `[IT000006]`
- `RE: [IT000006] Printer broken`

**2. Email Headers**
- `inReplyTo`: References original message ID
- `references`: Email thread chain
- `conversationId`: Microsoft 365 conversation grouping

**3. Fallback Strategy**

If reply endpoint returns 404:
1. Try with `conversationId`
2. If fails, retry with `ticketNumber` from subject
3. If still fails, log to DLQ

---

## Error Handling

### Dead Letter Queue (DLQ)

Failed emails are logged to `email_dlq` table with:
- Original message ID
- Error message
- Stack trace
- Raw payload
- Retry count

### Retry Strategy

1. First attempt: Process normally
2. On failure: Wait 5 minutes, retry
3. After 3 failures: Move to DLQ
4. DLQ emails: Manual review required

### Common Errors

**Rate Limit Exceeded:**
```
Solution: Increase EMAIL_POLLING_INTERVAL_MS
Current: 60000ms (1 minute)
Recommended: 120000ms (2 minutes) for high volume
```

**Authentication Failed:**
```
Check:
1. AZURE_AD_CLIENT_SECRET is valid
2. App registration has Mail.ReadWrite permission
3. Admin consent granted
```

**Classification Timeout:**
```
Solution: OpenAI API slow response
- Increase EMAIL_POLLING_TIMEOUT_MS
- Check OPENAI_API_KEY is valid
- Verify API rate limits
```

---

## Performance Tuning

### High Volume Inboxes

**Problem**: 100+ emails per day

**Solution**:
```env
EMAIL_POLLING_INTERVAL_MS=30000          # Poll every 30 seconds
EMAIL_POLLING_BATCH_SIZE=20              # Process 20 per poll
EMAIL_POLLING_TIMEOUT_MS=60000           # 60s timeout
```

### Low Volume Inboxes

**Problem**: 10-20 emails per day

**Solution**:
```env
EMAIL_POLLING_INTERVAL_MS=300000         # Poll every 5 minutes
EMAIL_POLLING_BATCH_SIZE=5               # Process 5 per poll
EMAIL_POLLING_TIMEOUT_MS=30000           # 30s timeout
```

### Resource Optimization

**Disable Classification** (use heuristics only):
```env
EMAIL_CLASSIFICATION_ENABLED=false
```

**Disable Auto-Read** (manual marking):
```env
EMAIL_AUTO_MARK_READ=false
```

---

## Monitoring

### Metrics Tracked

- `emails_polled_total`: Total emails processed
- `emails_classified_support`: Tickets created
- `emails_classified_vendor`: Vendor emails archived
- `emails_classified_unclear`: Manual review needed
- `emails_failed`: Processing errors
- `poll_duration_ms`: Time per poll cycle
- `classification_duration_ms`: AI classification time

### Health Check

**Endpoint**: `GET /api/jobs/email-polling/health`

**Response**:
```json
{
  "status": "healthy",
  "isRunning": true,
  "lastPoll": "2025-10-09T12:00:00Z",
  "lastSuccess": "2025-10-09T12:00:00Z",
  "uptime": 3600,
  "stats": {
    "total": 150,
    "success": 145,
    "failed": 5,
    "support": 120,
    "vendor": 20,
    "unclear": 5
  }
}
```

---

## Migration from N8N

### Step 1: Preparation

1. ✅ Ensure all environment variables are set
2. ✅ Test classification with sample emails
3. ✅ Verify API endpoints are working

### Step 2: Parallel Run

1. Keep N8N running
2. Enable native polling: `EMAIL_POLLING_ENABLED=true`
3. Monitor for duplicates (shouldn't happen due to message ID dedup)
4. Run for 24 hours

### Step 3: Cutover

1. Stop N8N workflow
2. Monitor native service for issues
3. Check DLQ for failed emails
4. Run for 1 week

### Step 4: Cleanup

1. Archive N8N workflow JSON files
2. Remove N8N Docker container
3. Update documentation

---

## Troubleshooting

### Issue: Emails not being processed

**Check**:
```bash
# Is polling enabled?
grep EMAIL_POLLING_ENABLED .env.local

# Check server logs
tail -f logs/email-polling.log

# Check status
curl http://localhost:3000/api/jobs/email-polling/status
```

### Issue: Duplicate tickets created

**Cause**: Both N8N and native service running

**Fix**:
```bash
# Stop N8N workflow immediately
# OR disable native polling
EMAIL_POLLING_ENABLED=false
```

### Issue: Classification always returns "unclear"

**Cause**: OpenAI API key invalid or rate limited

**Fix**:
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check rate limits in OpenAI dashboard
```

### Issue: Replies not being threaded

**Cause**: Ticket number not in subject line

**Fix**:
- Ensure email client preserves subject line
- Check Microsoft 365 email template
- Verify ticket number format: `[Ticket #IT000006]`

---

## Security

### Access Control

- ✅ Polling service runs as system user
- ✅ Admin endpoints require authentication
- ✅ Webhook secrets validated
- ✅ Rate limiting on all endpoints

### Data Privacy

- ✅ HTML sanitization on all email content
- ✅ Email bodies truncated to 5000 chars
- ✅ Attachments scanned for viruses
- ✅ PII redacted in audit logs

### Permissions Required

**Microsoft Graph API**:
- `Mail.ReadWrite` (read and update emails)
- `offline_access` (refresh tokens)

**OpenAI API**:
- Standard API access for GPT-3.5-turbo

---

## API Reference

### Start Polling

```http
POST /api/jobs/email-polling/start
Authorization: Bearer {token}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Email polling started",
  "interval": 60000
}
```

### Stop Polling

```http
POST /api/jobs/email-polling/stop
Authorization: Bearer {token}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Email polling stopped"
}
```

### Trigger Manual Poll

```http
POST /api/jobs/email-polling/trigger
Authorization: Bearer {token}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "processed": 5,
  "support": 3,
  "vendor": 1,
  "unclear": 1,
  "failed": 0
}
```

### Get Status

```http
GET /api/jobs/email-polling/status
Authorization: Bearer {token}
```

**Response**: `200 OK`
```json
{
  "isRunning": true,
  "lastPoll": "2025-10-09T12:00:00Z",
  "interval": 60000,
  "stats": {
    "total": 150,
    "success": 145,
    "failed": 5
  }
}
```

---

## Changelog

### Version 1.0.0 (2025-10-09)

**Initial Release**

- ✅ Email polling every 1 minute
- ✅ AI classification with OpenAI
- ✅ Reply detection and threading
- ✅ Support/vendor/unclear routing
- ✅ Automatic email read management
- ✅ Admin dashboard
- ✅ Manual control API
- ✅ Health monitoring
- ✅ Error recovery with DLQ

**Removed from N8N**:
- ❌ Email forwarding (caused loops)
- ❌ External dependency on N8N
- ❌ Docker overhead

---

## Support

For issues or questions:

1. Check logs: `/logs/email-polling.log`
2. Review DLQ: Check `email_dlq` table
3. Test manually: Use trigger API
4. Contact: IT Admin

---

## License

Internal use only - Surterre Properties
