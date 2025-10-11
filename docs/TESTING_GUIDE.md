# Email-to-Ticket System - Testing Guide

## 🧪 Complete Testing Instructions

This guide provides step-by-step instructions to test the Email-to-Ticket system.

---

## Prerequisites

### 1. Environment Setup

Ensure your `.env.local` has all required variables:

```bash
# Email Feature Flags
INBOUND_EMAIL_ENABLED=true
N8N_WEBHOOK_SECRET=dev_webhook_secret_min_32_chars_change_in_production_12345678
REPLY_WEBHOOK_SECRET=dev_reply_secret_min_32_chars_change_in_production_87654321

# DigitalOcean Spaces
SPACES_ENDPOINT=sfo3.digitaloceanspaces.com
SPACES_REGION=sfo3
SPACES_BUCKET=aidin-helpdesk-attachments
SPACES_ACCESS_KEY_ID=key-1760032170051
SPACES_SECRET_ACCESS_KEY=PMXYdyEBonVYuws75EGs5fBq5KteHq/iyyk9pu35LLw
SPACES_CDN_ENDPOINT=https://aidin-helpdesk-attachments.sfo3.cdn.digitaloceanspaces.com

# OpenAI (for classification)
OPENAI_API_KEY=sk-...

# Security & Limits
MAX_ATTACHMENT_MB=25
HTML_SANITIZER_STRICT=true
CLASSIFY_MIN_CONFIDENCE=0.7
RATE_LIMIT_MAX_REQUESTS_PER_WINDOW=20
RATE_LIMIT_WINDOW_MS=60000
AI_CLASSIFICATION_TIMEOUT_MS=10000
```

### 2. Database Initialization

Initialize department sequences:

```bash
sqlite3 prisma/dev.db << 'EOF'
INSERT INTO department_sequences (id, department_code, department_name, next_number, last_reserved_at, created_at, updated_at)
VALUES
  (hex(randomblob(16)), 'IT', 'Information Technology', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'HR', 'Human Resources', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'FIN', 'Finance', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'MKT', 'Marketing', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'BRK', 'Brokerage', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'OPS', 'Operations', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'LEG', 'Legal', 1, datetime('now'), datetime('now'), datetime('now')),
  (hex(randomblob(16)), 'GN', 'General', 1, datetime('now'), datetime('now'), datetime('now'))
ON CONFLICT(department_code) DO NOTHING;
EOF
```

Verify:

```bash
sqlite3 prisma/dev.db "SELECT department_code, department_name, next_number FROM department_sequences;"
```

Expected output:
```
IT|Information Technology|1
HR|Human Resources|1
FIN|Finance|1
MKT|Marketing|1
BRK|Brokerage|1
OPS|Operations|1
LEG|Legal|1
GN|General|1
```

### 3. Start Development Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

---

## Test Scenarios

### Test 1: New Email → New Ticket

**Scenario**: Simulate N8N sending a new IT support email

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-message-001@example.com>",
    "from": "john.doe@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Printer not working on 3rd floor",
    "text": "Hi, the HP printer on the 3rd floor is showing a paper jam error. I tried to clear it but it still wont print. Can someone help?",
    "html": "<p>Hi,</p><p>The HP printer on the 3rd floor is showing a paper jam error. I tried to clear it but it still wont print. Can someone help?</p>",
    "attachments": [],
    "receivedAt": "2025-10-09T10:30:00Z"
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "ticketId": "uuid-here",
  "ticketNumber": "IT000001",
  "messageId": "<test-message-001@example.com>",
  "classification": {
    "department": "IT",
    "tags": ["printer", "hardware"],
    "confidence": 0.85,
    "method": "ai"
  },
  "attachments": 0
}
```

**Verification**:

```bash
# Check ticket was created
sqlite3 prisma/dev.db "SELECT ticket_number, title, status, category FROM tickets WHERE ticket_number='IT000001';"

# Check email was ingested
sqlite3 prisma/dev.db "SELECT message_id, from_email, subject FROM email_ingest WHERE message_id='<test-message-001@example.com>';"

# Check ticket message was created
sqlite3 prisma/dev.db "SELECT kind, author_email, subject FROM ticket_messages WHERE ticket_id=(SELECT id FROM tickets WHERE ticket_number='IT000001');"

# Check tags were applied
sqlite3 prisma/dev.db "SELECT t.name FROM tags t JOIN ticket_tags tt ON t.id=tt.tag_id JOIN tickets tk ON tt.ticket_id=tk.id WHERE tk.ticket_number='IT000001';"
```

---

### Test 2: Email with Attachments

**Scenario**: Email with base64-encoded attachment

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-message-002@example.com>",
    "from": "jane.smith@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Invoice payment question",
    "text": "Please see attached invoice. When will this be processed?",
    "html": "<p>Please see attached invoice. When will this be processed?</p>",
    "attachments": [
      {
        "filename": "invoice-12345.pdf",
        "contentType": "application/pdf",
        "size": 45678,
        "base64": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iag==",
        "inline": false,
        "cid": null
      }
    ],
    "receivedAt": "2025-10-09T11:00:00Z"
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "ticketId": "uuid-here",
  "ticketNumber": "FIN000001",
  "messageId": "<test-message-002@example.com>",
  "classification": {
    "department": "FIN",
    "tags": ["invoice", "payment"],
    "confidence": 0.92,
    "method": "ai"
  },
  "attachments": 1
}
```

**Verification**:

```bash
# Check attachment was saved
sqlite3 prisma/dev.db "SELECT filename, content_type, size, storage_url FROM email_attachments WHERE email_ingest_id=(SELECT id FROM email_ingest WHERE message_id='<test-message-002@example.com>');"

# Test CDN URL is accessible
# Copy storage_url from above query and test:
curl -I https://aidin-helpdesk-attachments.sfo3.cdn.digitaloceanspaces.com/attachments/2025/10/09/{uuid}-invoice-12345.pdf
```

---

### Test 3: Reply Threading (In-Reply-To)

**Scenario**: User replies to ticket IT000001

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email-reply \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_reply_secret_min_32_chars_change_in_production_87654321" \
  -d '{
    "messageId": "<test-reply-001@example.com>",
    "inReplyTo": "<test-message-001@example.com>",
    "references": ["<test-message-001@example.com>"],
    "from": "john.doe@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Re: [IT000001] Printer not working on 3rd floor",
    "text": "Actually, I just found the issue. There was a staple stuck in the paper tray. Its working now, thanks!",
    "html": "<p>Actually, I just found the issue. There was a staple stuck in the paper tray. Its working now, thanks!</p>",
    "attachments": []
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "ticketId": "uuid-of-IT000001",
  "ticketNumber": "IT000001",
  "messageId": "<test-reply-001@example.com>",
  "action": "reply_added",
  "attachments": 0
}
```

**Verification**:

```bash
# Check new message was added to ticket
sqlite3 prisma/dev.db "SELECT kind, author_email, text FROM ticket_messages WHERE ticket_id=(SELECT id FROM tickets WHERE ticket_number='IT000001') ORDER BY created_at;"

# Check ticket status was reopened (if it was SOLVED)
sqlite3 prisma/dev.db "SELECT status FROM tickets WHERE ticket_number='IT000001';"
```

---

### Test 4: Idempotency (Duplicate Message-ID)

**Scenario**: Resend same email (should be deduplicated)

**Curl Command** (reuse Test 1 payload):

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-message-001@example.com>",
    "from": "john.doe@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Printer not working on 3rd floor",
    "text": "Hi, the HP printer on the 3rd floor is showing a paper jam error.",
    "html": "<p>Hi,</p><p>The HP printer on the 3rd floor is showing a paper jam error.</p>",
    "attachments": [],
    "receivedAt": "2025-10-09T10:30:00Z"
  }'
```

**Expected Response** (200 OK):

```json
{
  "status": "duplicate",
  "ticketId": "uuid-of-IT000001",
  "messageId": "<test-message-001@example.com>"
}
```

**Verification**:

```bash
# Should still only have 1 ticket
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM tickets WHERE ticket_number='IT000001';"
# Expected: 1

# Should only have 1 email_ingest record
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM email_ingest WHERE message_id='<test-message-001@example.com>';"
# Expected: 1
```

---

### Test 5: Rate Limiting

**Scenario**: Send 21 emails from same sender (exceeds limit of 20)

**Bash Script**:

```bash
#!/bin/bash
for i in {1..21}; do
  echo "Sending email $i..."

  curl -X POST http://localhost:3000/api/inbound/email \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
    -d "{
      \"messageId\": \"<test-ratelimit-$i@example.com>\",
      \"from\": \"spammer@example.com\",
      \"to\": \"support@yourcompany.com\",
      \"subject\": \"Test email $i\",
      \"text\": \"This is test email number $i\",
      \"html\": \"<p>This is test email number $i</p>\",
      \"attachments\": []
    }" \
    -s | jq -c '.'

  sleep 0.5
done
```

**Expected Behavior**:
- First 20 emails: `{"success": true, ...}`
- 21st email: `{"error": "Rate limit exceeded", "retryAfter": 60}`

**Verification**:

```bash
# Check rate limit entries
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM rate_limit_entries WHERE identifier='spammer@example.com';"
# Expected: 20

# Check tickets created
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM tickets WHERE requester_id=(SELECT id FROM users WHERE email='spammer@example.com');"
# Expected: 20 (not 21)
```

---

### Test 6: Invalid Webhook Secret

**Scenario**: Send email with wrong secret

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: WRONG_SECRET" \
  -d '{
    "messageId": "<test-auth-fail@example.com>",
    "from": "hacker@evil.com",
    "to": "support@yourcompany.com",
    "subject": "Should be rejected",
    "text": "This should not create a ticket",
    "html": "<p>This should not create a ticket</p>",
    "attachments": []
  }'
```

**Expected Response** (401 Unauthorized):

```json
{
  "error": "Unauthorized"
}
```

**Verification**:

```bash
# Should have no ticket created
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM email_ingest WHERE message_id='<test-auth-fail@example.com>';"
# Expected: 0
```

---

### Test 7: Reply Detection (409 Conflict)

**Scenario**: Send reply to /api/inbound/email (should be rejected)

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-reply-wrong-endpoint@example.com>",
    "inReplyTo": "<test-message-001@example.com>",
    "from": "john.doe@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Re: [IT000001] Printer not working",
    "text": "This is a reply",
    "html": "<p>This is a reply</p>",
    "attachments": []
  }'
```

**Expected Response** (409 Conflict):

```json
{
  "error": "Reply detected, use /api/inbound/email-reply",
  "inReplyTo": "<test-message-001@example.com>",
  "detectedTicketId": "IT000001"
}
```

---

### Test 8: HTML Sanitization (XSS Prevention)

**Scenario**: Send email with malicious HTML

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-xss-001@example.com>",
    "from": "attacker@evil.com",
    "to": "support@yourcompany.com",
    "subject": "XSS Test",
    "text": "Testing XSS prevention",
    "html": "<p>Hello</p><script>alert(\"XSS\")</script><p>World</p><img src=x onerror=\"alert(1)\">",
    "attachments": []
  }'
```

**Expected Behavior**:
- Email is accepted (200 OK)
- Script tags and event handlers are stripped

**Verification**:

```bash
# Check sanitized HTML
sqlite3 prisma/dev.db "SELECT html FROM email_ingest WHERE message_id='<test-xss-001@example.com>';"
# Expected: Should NOT contain <script> or onerror=
# Expected: Should contain <p>Hello</p><p>World</p>
```

---

### Test 9: Classification Fallback (No OpenAI Key)

**Scenario**: Test keyword classification when AI is unavailable

**Setup**:
```bash
# Temporarily remove OpenAI key
export OPENAI_API_KEY=""
```

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
  -d '{
    "messageId": "<test-keyword-classify@example.com>",
    "from": "employee@acme.com",
    "to": "hr@yourcompany.com",
    "subject": "Question about my payroll",
    "text": "I need help with my payroll. My last paycheck was incorrect and I am missing some hours.",
    "html": "<p>I need help with my payroll. My last paycheck was incorrect and I am missing some hours.</p>",
    "attachments": []
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "ticketId": "uuid-here",
  "ticketNumber": "HR000001",
  "messageId": "<test-keyword-classify@example.com>",
  "classification": {
    "department": "HR",
    "tags": ["payroll"],
    "confidence": 0.2,
    "method": "keyword"
  },
  "attachments": 0
}
```

**Restore**:
```bash
export OPENAI_API_KEY=sk-your-key-here
```

---

### Test 10: Thread Detection via Subject Token

**Scenario**: Reply without In-Reply-To header (using subject token)

**Curl Command**:

```bash
curl -X POST http://localhost:3000/api/inbound/email-reply \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_reply_secret_min_32_chars_change_in_production_87654321" \
  -d '{
    "messageId": "<test-subject-thread@example.com>",
    "from": "john.doe@acme.com",
    "to": "support@yourcompany.com",
    "subject": "Re: [IT000001] Printer not working on 3rd floor",
    "text": "Just wanted to follow up on this ticket.",
    "html": "<p>Just wanted to follow up on this ticket.</p>",
    "attachments": []
  }'
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "ticketId": "uuid-of-IT000001",
  "ticketNumber": "IT000001",
  "messageId": "<test-subject-thread@example.com>",
  "action": "reply_added",
  "attachments": 0
}
```

---

## Troubleshooting

### Issue: "Email ingestion disabled" (503)

**Solution**: Set `INBOUND_EMAIL_ENABLED=true` in `.env.local`

### Issue: "Unauthorized" (401)

**Cause**: Webhook secret mismatch

**Solution**: Ensure header `x-webhook-secret` matches:
- `/api/inbound/email` → `N8N_WEBHOOK_SECRET`
- `/api/inbound/email-reply` → `REPLY_WEBHOOK_SECRET`

### Issue: "Rate limit exceeded" (429)

**Solution**: Wait 60 seconds or reset rate limit:

```bash
sqlite3 prisma/dev.db "DELETE FROM rate_limit_entries WHERE identifier='your-email@example.com';"
```

### Issue: "Could not find original ticket" (404)

**Cause**: Reply endpoint cannot find parent ticket

**Debug**:
```bash
# Check if original email exists
sqlite3 prisma/dev.db "SELECT * FROM email_ingest WHERE message_id='<original-message-id>';"

# Check if ticket exists
sqlite3 prisma/dev.db "SELECT * FROM tickets WHERE ticket_number='IT000001';"
```

### Issue: Attachment upload fails

**Cause**: DigitalOcean Spaces credentials invalid

**Verify**:
```bash
# Check environment variables
echo $SPACES_ACCESS_KEY_ID
echo $SPACES_SECRET_ACCESS_KEY

# Test bucket access
aws s3 ls s3://aidin-helpdesk-attachments \
  --endpoint-url=https://sfo3.digitaloceanspaces.com \
  --region=sfo3
```

### Issue: Classification always returns "GN" (General)

**Cause 1**: OpenAI API key missing or invalid

**Solution**: Set `OPENAI_API_KEY=sk-...` in `.env.local`

**Cause 2**: AI confidence below threshold

**Solution**: Lower threshold: `CLASSIFY_MIN_CONFIDENCE=0.5`

---

## Database Queries

### View All Tickets Created

```bash
sqlite3 prisma/dev.db "SELECT ticket_number, title, status, category, created_at FROM tickets ORDER BY created_at DESC LIMIT 20;"
```

### View All Email Ingestions

```bash
sqlite3 prisma/dev.db "SELECT message_id, from_email, subject, processed_at FROM email_ingest ORDER BY processed_at DESC LIMIT 20;"
```

### View Ticket Threading

```bash
sqlite3 prisma/dev.db "
SELECT
  tm.kind,
  tm.author_email,
  substr(tm.text, 1, 50) as preview,
  tm.created_at
FROM ticket_messages tm
JOIN tickets t ON tm.ticket_id = t.id
WHERE t.ticket_number = 'IT000001'
ORDER BY tm.created_at ASC;
"
```

### View Department Sequences

```bash
sqlite3 prisma/dev.db "SELECT department_code, next_number, last_reserved_at FROM department_sequences ORDER BY department_code;"
```

### View Failed Emails (DLQ)

```bash
sqlite3 prisma/dev.db "SELECT id, error, substr(raw_payload, 1, 100), created_at FROM email_dlq ORDER BY created_at DESC LIMIT 10;"
```

### View Rate Limits

```bash
sqlite3 prisma/dev.db "
SELECT
  identifier,
  COUNT(*) as requests,
  MIN(request_at) as first_request,
  MAX(request_at) as last_request
FROM rate_limit_entries
WHERE request_at > datetime('now', '-1 hour')
GROUP BY identifier
ORDER BY requests DESC;
"
```

### View Audit Log

```bash
sqlite3 prisma/dev.db "
SELECT
  action,
  actor_email,
  entity_type,
  created_at
FROM audit_logs
WHERE action LIKE 'email.%'
ORDER BY created_at DESC
LIMIT 20;
"
```

---

## N8N Workflow Testing

Once N8N is configured, test the full flow:

1. **Send test email to monitored inbox**
2. **N8N processes email and calls webhook**
3. **Verify ticket created in AIDIN**
4. **Reply to confirmation email**
5. **Verify reply threaded correctly**

See `docs/workflows/email-to-ticket.md` for N8N workflow configuration.

---

## Performance Testing

### Load Test (100 emails)

```bash
#!/bin/bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/inbound/email \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: dev_webhook_secret_min_32_chars_change_in_production_12345678" \
    -d "{
      \"messageId\": \"<load-test-$i@example.com>\",
      \"from\": \"user$i@example.com\",
      \"to\": \"support@yourcompany.com\",
      \"subject\": \"Load test email $i\",
      \"text\": \"This is load test email number $i\",
      \"html\": \"<p>This is load test email number $i</p>\",
      \"attachments\": []
    }" \
    -s -o /dev/null -w "Email $i: %{http_code} - %{time_total}s\n" &

  # Limit concurrent requests
  if [ $((i % 10)) -eq 0 ]; then
    wait
  fi
done
wait
```

**Verify**:
```bash
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM tickets;"
# Expected: 100

sqlite3 prisma/dev.db "SELECT COUNT(DISTINCT department_code) FROM department_sequences;"
# Expected: 8 (all departments initialized)
```

---

## Success Criteria

✅ **New emails create tickets with department-specific IDs**
✅ **Replies thread correctly using multiple strategies**
✅ **Attachments uploaded to DigitalOcean Spaces**
✅ **HTML sanitized and safe**
✅ **Rate limiting prevents abuse**
✅ **Idempotency prevents duplicates**
✅ **Classification assigns correct department**
✅ **Audit logs track all actions**
✅ **DLQ captures failures**
✅ **Webhook authentication prevents unauthorized access**

---

## Production Checklist

Before deploying to production:

- [ ] Change `N8N_WEBHOOK_SECRET` to secure random value (min 32 chars)
- [ ] Change `REPLY_WEBHOOK_SECRET` to different secure random value
- [ ] Rotate `SPACES_SECRET_ACCESS_KEY` as mentioned by user
- [ ] Set `OPENAI_API_KEY` to production key
- [ ] Configure N8N workflow with production credentials
- [ ] Set up monitoring/alerting for DLQ entries
- [ ] Configure automated rate limit cleanup cron job
- [ ] Test email confirmation sending (outbound flow)
- [ ] Set up CDN caching rules for Spaces
- [ ] Configure CORS if accessing attachments from frontend

---

## Support

For issues or questions:
- Check DLQ: `sqlite3 prisma/dev.db "SELECT * FROM email_dlq ORDER BY created_at DESC LIMIT 5;"`
- Check logs: Server console output
- Review docs: `docs/workflows/email-to-ticket.md`
