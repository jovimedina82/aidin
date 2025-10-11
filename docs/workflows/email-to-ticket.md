# **AIDIN Helpdesk - Email-to-Ticket System**

## **Implementation Status: 🚧 IN PROGRESS**

Enterprise-grade email ingestion system with threading, deduplication, and DigitalOcean Spaces storage.

---

## **✅ COMPLETED COMPONENTS**

### 1. **Database Models** (`prisma/schema.prisma`)
- ✅ `EmailIngest` - Email metadata with Message-ID deduplication
- ✅ `EmailAttachment` - Attachments with CID support for inline images
- ✅ `TicketMessage` - Unified message history (emails + comments)
- ✅ `DepartmentSequence` - Atomic per-department ticket ID sequences
- ✅ `Tag` / `TicketTag` - Flexible tagging system
- ✅ `RateLimitEntry` - In-database rate limiting
- ✅ `EmailDLQ` - Dead Letter Queue for failed emails

### 2. **ID Generation** (`modules/tickets/id.ts`)
- ✅ Atomic sequence generation with `SELECT FOR UPDATE` semantics
- ✅ Per-department sequences (IT, HR, FIN, MKT, BRK, OPS, LEG, GN)
- ✅ Format: `DEPT000123` (2-5 letters + 6 digits, zero-padded)
- ✅ Batch reservation support
- ✅ Sequence status endpoints

### 3. **Subject Formatting** (`modules/tickets/subject.ts`)
- ✅ Canonical format: `[DEPT######] Original Subject`
- ✅ Token extraction for threading
- ✅ Token stripping to avoid duplication
- ✅ Reply/Forward prefix preservation
- ✅ Subject normalization for fuzzy matching

---

## **🚧 REMAINING IMPLEMENTATION**

### Priority 1: Critical Infrastructure

#### **A. DigitalOcean Spaces Storage Adapter** (`modules/storage/spaces.ts`)
```typescript
// Required environment variables
SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_REGION=nyc3
SPACES_BUCKET=aidin-helpdesk-attachments
SPACES_ACCESS_KEY_ID=...
SPACES_SECRET_ACCESS_KEY=...
SPACES_CDN_ENDPOINT=...

// Features needed:
- putStream(key, stream, contentType, size)
- putBase64(key, base64Data, contentType)
- getSignedUrl(key, expiresIn)
- deleteObject(key)
- Content-type validation
- Size limit enforcement (MAX_ATTACHMENT_MB=25)
- Disallowed file type blocking
```

#### **B. HTML Sanitizer** (`lib/security/html-sanitizer.ts`)
```typescript
// Use DOMPurify-style approach
- Strip <script>, <iframe>, <object>, <embed>
- Whitelist safe tags: <p>, <div>, <span>, <a>, <img>, <ul>, <li>, <table>
- Remove event handlers (onclick, onload, etc.)
- Sanitize data: URLs in images (allow only small image/* types)
- Collapse external resources unless whitelisted
- Preserve inline images with cid: URLs
```

#### **C. Email Department Classifier** (`modules/classify/email.ts`)
```typescript
export async function classifyDepartmentAndTags(params: {
  subject: string;
  text: string;
  html: string;
  from: string;
  to: string;
}): Promise<{
  departmentCode: string; // IT, HR, FIN, etc. or UNCLASSIFIED
  tags: string[];         // kebab-case tags
  confidence: number;     // 0-1
  reasoning: string;
}> {
  // 1. Try AI classification (GPT-4o-mini)
  const aiResult = await callOpenAI(params);

  if (aiResult.confidence >= CLASSIFY_MIN_CONFIDENCE) {
    return {
      departmentCode: aiResult.department,
      tags: aiResult.tags.map(normalizeTag),
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning
    };
  }

  // 2. Fallback: keyword matching
  const keywordMatch = await matchDepartmentKeywords(params.subject + ' ' + params.text);

  if (keywordMatch.confidence >= 0.5) {
    return keywordMatch;
  }

  // 3. Final fallback
  return {
    departmentCode: 'UNCLASSIFIED',
    tags: ['uncategorized'],
    confidence: 0.1,
    reasoning: 'Below confidence threshold, using fallback'
  };
}

// Keyword fallback mapping
const KEYWORD_MAP = {
  'IT': ['printer', 'computer', 'laptop', 'password', 'email', 'software', 'network'],
  'HR': ['benefits', 'payroll', 'pto', 'vacation', 'onboarding', 'termination'],
  'FIN': ['invoice', 'payment', 'expense', 'reimbursement', 'accounting'],
  // ...
};
```

---

### Priority 2: Webhook Endpoints

#### **D. N8N Inbound Webhook** (`app/api/inbound/email/route.ts`)
```typescript
export async function POST(request: NextRequest) {
  // 1. HMAC Authentication (timing-safe)
  const signature = request.headers.get('x-webhook-secret');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(N8N_WEBHOOK_SECRET))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse payload
  const {
    messageId,
    inReplyTo,
    references,
    from,
    to,
    subject,
    html,
    text,
    attachments, // [{filename, contentType, size, base64, cid, inline}]
  } = await request.json();

  // 3. Idempotency check (Message-ID)
  const existing = await prisma.emailIngest.findUnique({
    where: { messageId }
  });
  if (existing) {
    return NextResponse.json({
      status: 'duplicate',
      ticketId: existing.ticketId
    }, { status: 200 });
  }

  // 4. Thread detection
  if (inReplyTo || references || extractTicketId(subject)) {
    return NextResponse.json({
      error: 'Reply detected, use /api/inbound/email-reply'
    }, { status: 409 });
  }

  // 5. Rate limiting
  await checkRateLimit(from, '/api/inbound/email');

  // 6. Sanitize HTML
  const sanitizedHtml = sanitizeHtml(html);

  // 7. Upload attachments to Spaces
  const uploadedAttachments = await Promise.all(
    attachments.map(att => uploadAttachment(att, messageId))
  );

  // 8. Classify department & tags
  const classification = await classifyDepartmentAndTags({
    subject,
    text,
    html: sanitizedHtml,
    from,
    to
  });

  // 9. Reserve ticket ID
  const ticketId = await reserveTicketId(classification.departmentCode);

  // 10. Create EmailIngest record
  const dedupeHash = createHash('sha256')
    .update(`${messageId}|${from}|${subject}`)
    .digest('hex');

  const emailIngest = await prisma.emailIngest.create({
    data: {
      messageId,
      inReplyTo,
      references: JSON.stringify(references || []),
      from,
      to,
      subject,
      html: sanitizedHtml,
      text,
      snippet: text?.substring(0, 200),
      rawHeaders: JSON.stringify({}),
      dedupeHash,
      processedAt: new Date()
    }
  });

  // 11. Create Ticket
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: ticketId,
      title: subject,
      description: text || stripHtml(sanitizedHtml),
      status: 'NEW',
      priority: classification.priority || 'NORMAL',
      category: classification.tags[0] || 'General',
      requesterId: findOrCreateUserByEmail(from),
      emailConversationId: null, // Will be set when we send confirmation
    }
  });

  // 12. Create TicketMessage
  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      kind: 'email',
      authorEmail: from,
      html: sanitizedHtml,
      text,
      subject,
      metadata: JSON.stringify({ emailIngestId: emailIngest.id })
    }
  });

  // 13. Save attachments
  for (const att of uploadedAttachments) {
    await prisma.emailAttachment.create({
      data: {
        emailIngestId: emailIngest.id,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        storageKey: att.storageKey,
        isInline: att.inline,
        cid: att.cid,
        virusScanStatus: 'pending'
      }
    });
  }

  // 14. Send confirmation email
  const confirmationSubject = formatTicketSubject(ticketId, subject);
  await sendConfirmationEmail({
    to: from,
    subject: confirmationSubject,
    ticketId,
    replyTo: HELPDESK_EMAIL
  });

  // 15. Audit log
  await logEvent({
    action: 'email.received',
    actorType: 'system',
    actorEmail: from,
    entityType: 'email',
    entityId: emailIngest.id,
    targetId: ticket.id,
    metadata: { ticketId, messageId, from, subject }
  });

  return NextResponse.json({
    success: true,
    ticketId,
    ticketNumber: ticketId,
    messageId,
    classification
  });
}
```

#### **E. Direct Reply Endpoint** (`app/api/inbound/email-reply/route.ts`)
```typescript
export async function POST(request: NextRequest) {
  // Similar structure to inbound/email but:
  // 1. Check REPLY_WEBHOOK_SECRET
  // 2. Parse In-Reply-To/References headers
  // 3. Lookup EmailIngest by In-Reply-To -> find ticket
  // 4. Fallback: extract ticket ID from subject
  // 5. Append as TicketMessage (kind='email')
  // 6. Save attachments
  // 7. Audit: comment.created (kind=email)
  // 8. NO confirmation email (already in thread)
}
```

---

### Priority 3: Security & Observability

#### **F. Timing-Safe HMAC Validation** (`lib/security/hmac.ts`)
```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer);
}
```

#### **G. Rate Limiting** (`lib/security/rate-limit.ts`)
```typescript
export async function checkRateLimit(
  identifier: string, // IP or email
  endpoint: string
): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const windowEnd = new Date();

  const count = await prisma.rateLimitEntry.count({
    where: {
      identifier,
      endpoint,
      requestAt: {
        gte: windowStart,
        lte: windowEnd
      }
    }
  });

  if (count >= RATE_LIMIT_MAX_REQUESTS_PER_WINDOW) {
    throw new Error('Rate limit exceeded');
  }

  // Record this request
  await prisma.rateLimitEntry.create({
    data: {
      identifier,
      endpoint,
      requestAt: new Date(),
      expiresAt: new Date(Date.now() + RATE_LIMIT_WINDOW_MS)
    }
  });

  // Cleanup expired entries (async)
  prisma.rateLimitEntry.deleteMany({
    where: { expiresAt: { lte: new Date() } }
  }).catch(console.error);
}
```

---

## **N8N WORKFLOW CONFIGURATION**

### **Trigger: IMAP or Microsoft Graph**
1. Poll helpdesk inbox every 30 seconds
2. Fetch new emails with full headers

### **Filter: New vs Reply**
```javascript
// Check if email is a reply
const isReply = (
  item.headers['in-reply-to'] ||
  item.headers['references'] ||
  /\[([A-Z]{2,5}\d{6})\]/.test(item.subject)
);

if (isReply) {
  // Route to reply endpoint
  return { endpoint: '/api/inbound/email-reply' };
} else {
  // Route to new ticket endpoint
  return { endpoint: '/api/inbound/email' };
}
```

### **Transform: Build JSON Payload**
```javascript
{
  "messageId": "{{$json.headers['message-id']}}",
  "inReplyTo": "{{$json.headers['in-reply-to']}}",
  "references": "{{$json.headers.references?.split(' ')}}",
  "from": "{{$json.from.address}}",
  "to": "{{$json.to[0].address}}",
  "cc": "{{$json.cc?.map(c => c.address)}}",
  "subject": "{{$json.subject}}",
  "html": "{{$json.html}}",
  "text": "{{$json.text}}",
  "attachments": "{{$json.attachments.map(att => ({
    filename: att.filename,
    contentType: att.contentType,
    size: att.size,
    base64: att.content.toString('base64'),
    cid: att.cid,
    inline: att.disposition === 'inline'
  }))}}",
  "receivedAt": "{{$json.date}}"
}
```

### **HTTP Request: POST to AidIN**
```javascript
{
  "method": "POST",
  "url": "{{$node['Filter'].json.endpoint}}",
  "headers": {
    "Content-Type": "application/json",
    "X-Webhook-Secret": "{{$env.N8N_WEBHOOK_SECRET}}"
  },
  "body": "{{$json}}",
  "options": {
    "timeout": 30000,
    "retry": {
      "max": 5,
      "interval": 2000,
      "backoff": true
    }
  }
}
```

---

## **DIGITAL OCEAN SPACES SETUP**

### **1. Create Space**
```bash
# Via DigitalOcean Console or API
doctl spaces create aidin-helpdesk-attachments --region nyc3
doctl spaces enable-cdn aidin-helpdesk-attachments --region nyc3
```

### **2. Configure CORS**
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://helpdesk.surterreproperties.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}
```

### **3. Set Lifecycle Policy (Optional)**
```json
{
  "Rules": [{
    "Id": "delete-old-attachments",
    "Status": "Enabled",
    "Expiration": {
      "Days": 730
    },
    "Prefix": "attachments/"
  }]
}
```

---

## **VERIFICATION PLAN**

### **Test 1: New Ticket from Email**
```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret-key" \
  -d '{
    "messageId": "<test-message-1@example.com>",
    "from": "user@example.com",
    "to": "helpdesk@surterreproperties.com",
    "subject": "Printer not working",
    "text": "My printer is offline and wont print anything.",
    "html": "<p>My printer is offline and wont print anything.</p>",
    "attachments": []
  }'

# Expected response:
# {
#   "success": true,
#   "ticketId": "IT000001",
#   "ticketNumber": "IT000001",
#   "messageId": "<test-message-1@example.com>",
#   "classification": {
#     "departmentCode": "IT",
#     "tags": ["printer", "hardware"],
#     "confidence": 0.89
#   }
# }
```

### **Test 2: Reply to Existing Ticket**
```bash
curl -X POST http://localhost:3000/api/inbound/email-reply \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-reply-secret-key" \
  -d '{
    "messageId": "<test-message-2@example.com>",
    "inReplyTo": "<test-message-1@example.com>",
    "from": "user@example.com",
    "to": "helpdesk@surterreproperties.com",
    "subject": "Re: [IT000001] Printer not working",
    "text": "I tried restarting it but it still doesnt work.",
    "html": "<p>I tried restarting it but it still doesnt work.</p>",
    "attachments": []
  }'

# Expected: Comment added to IT000001
```

### **Test 3: Deduplication**
```bash
# Send same message twice (same messageId)
# Expected: Second request returns { status: 'duplicate', ticketId: 'IT000001' }
```

### **Test 4: Attachment Upload**
```bash
# Send email with base64 attachment
# Expected: File uploaded to Spaces, signed URL returned
```

---

## **MANUAL STEPS POST-IMPLEMENTATION**

1. **Initialize Department Sequences**
```sql
INSERT INTO department_sequences (id, department_code, department_name, next_number, last_reserved_at)
VALUES
  (hex(randomblob(16)), 'IT', 'Information Technology', 1, datetime('now')),
  (hex(randomblob(16)), 'HR', 'Human Resources', 1, datetime('now')),
  (hex(randomblob(16)), 'FIN', 'Finance', 1, datetime('now')),
  (hex(randomblob(16)), 'MKT', 'Marketing', 1, datetime('now')),
  (hex(randomblob(16)), 'BRK', 'Brokerage', 1, datetime('now')),
  (hex(randomblob(16)), 'OPS', 'Operations', 1, datetime('now')),
  (hex(randomblob(16)), 'GN', 'General', 1, datetime('now'));
```

2. **Configure N8N Workflow**
- Import workflow JSON
- Set environment variables
- Test with sample email

3. **Update Reply-To Header**
- Configure SMTP to set Reply-To: helpdesk@surterreproperties.com
- Ensure replies route to direct reply endpoint

4. **Monitor DLQ**
```bash
# Check for failed emails
curl http://localhost:3000/api/admin/email-dlq

# Replay failed email
curl -X POST http://localhost:3000/api/admin/email-dlq/replay/UUID
```

---

## **DEPENDENCIES TO INSTALL**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

**Status:** 60% Complete | **ETA:** 4-6 hours remaining work
