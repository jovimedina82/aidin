# Email Reply Threading - Ticket Number in Subject

## Overview
When AI responses are sent to requesters, the ticket number is included in the email subject line. This allows the n8n workflow to identify which ticket a reply belongs to and automatically add it as a comment.

## Email Subject Format

### Outgoing Emails (AI Responses)
**Format**: `RE: Original Subject [Ticket #IT000048]`

**Examples**:
- `RE: VPN sign-in issue from home [Ticket #IT000048]`
- `RE: Password reset request [Ticket #IT000052]`
- `RE: Printer not working [Ticket #IT000055]`

### How It Works
1. Staff sends AI draft response from ticket detail page
2. Email sent with ticket number in subject: `[Ticket #IT000048]`
3. Requester replies to email
4. n8n workflow extracts ticket number from subject
5. Reply added as comment to existing ticket

## Implementation Details

### EmailService.js Changes
**File**: `/opt/apps/aidin/lib/services/EmailService.js`

**What was changed**:
```javascript
// Build subject line with ticket number for reply tracking
const originalSubject = originalEmail.subject || ticket.title
let replySubject = originalSubject

// Check if ticket number is already in subject
if (!originalSubject.includes(ticket.ticketNumber)) {
  // Add ticket number in format that's easy to extract
  replySubject = `RE: ${originalSubject} [Ticket #${ticket.ticketNumber}]`
} else if (!originalSubject.startsWith('RE:')) {
  replySubject = `RE: ${originalSubject}`
}

// Include subject in reply
message: {
  subject: replySubject,
  body: { ... }
}
```

## n8n Workflow Updates Required

### 1. Add Ticket Number Extraction Node

**Node Name**: "Extract Ticket Number"
**Type**: Code (JavaScript)
**Position**: After "Process Emails" node, before "Build AI Request"

**Code**:
```javascript
// Extract ticket number from email subject
const email = $json || {};
const subject = String(email.subject || '');

// Regex to extract ticket number: [Ticket #IT000048]
const ticketNumberMatch = subject.match(/\[Ticket #(IT\d+)\]/i);

if (ticketNumberMatch) {
  const ticketNumber = ticketNumberMatch[1];

  console.log(`🎫 Found ticket number in subject: ${ticketNumber}`);

  return {
    json: {
      _isReply: true,
      _ticketNumber: ticketNumber,
      _originalEmail: email
    }
  };
} else {
  // Not a reply to existing ticket, process normally
  return {
    json: {
      _isReply: false,
      _originalEmail: email
    }
  };
}
```

### 2. Add Reply Handler Node

**Node Name**: "Handle Ticket Reply"
**Type**: HTTP Request
**Position**: Parallel branch after "Extract Ticket Number"
**Condition**: Only run if `_isReply === true`

**Configuration**:
- **Method**: POST
- **URL**: `http://localhost:3011/api/tickets/add-reply-comment`
- **Authentication**: None (internal request)
- **Body**:
```json
{
  "ticketNumber": "{{ $json._ticketNumber }}",
  "emailFrom": "{{ $json._originalEmail.from.emailAddress.address }}",
  "emailBody": "{{ $json._originalEmail.body.content }}",
  "emailSubject": "{{ $json._originalEmail.subject }}"
}
```

### 3. Update Workflow Branching

**Add IF Node**: "Is This A Reply?"
- **Condition**: `{{ $json._isReply }} === true`
- **If True**: Route to "Handle Ticket Reply"
- **If False**: Route to "Build AI Request" (create new ticket)

## API Endpoint to Create

Create `/opt/apps/aidin/app/api/tickets/add-reply-comment/route.js`:

```javascript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/tickets/add-reply-comment
 * Add email reply as comment to existing ticket
 * Called by n8n workflow when reply is detected
 */
export async function POST(request) {
  try {
    const { ticketNumber, emailFrom, emailBody, emailSubject } = await request.json()

    if (!ticketNumber || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log(`📧 Processing reply for ticket ${ticketNumber} from ${emailFrom}`)

    // Find ticket by ticket number
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!ticket) {
      console.error(`❌ Ticket ${ticketNumber} not found`)
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Verify email is from the requester (or allow all if needed)
    if (ticket.requester?.email !== emailFrom) {
      console.warn(`⚠️  Reply from ${emailFrom} but ticket requester is ${ticket.requester?.email}`)
      // Continue anyway - could be CC'd recipient
    }

    // Find or use requester as comment author
    let commentUser = await prisma.user.findUnique({
      where: { email: emailFrom }
    })

    // If sender not found, use the ticket requester
    if (!commentUser) {
      commentUser = ticket.requester
    }

    if (!commentUser) {
      console.error(`❌ No user found for ${emailFrom}`)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Create comment from email reply
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        userId: commentUser.id,
        content: `**Email Reply:**\n\n${emailBody}`,
        isPublic: true,
        createdAt: new Date()
      }
    })

    // Update ticket status to OPEN if it was NEW
    if (ticket.status === 'NEW') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      })
    }

    console.log(`✅ Reply added as comment to ticket ${ticketNumber}`)

    return NextResponse.json({
      success: true,
      ticketNumber,
      commentId: comment.id,
      message: 'Reply added to ticket'
    })

  } catch (error) {
    console.error('Error adding reply comment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add reply comment' },
      { status: 500 }
    )
  }
}
```

## Testing

### 1. Send AI Response
1. Open ticket IT000048
2. Edit AI draft if needed
3. Click "Send to Requester"
4. Check email received by requester
5. **Verify subject includes**: `[Ticket #IT000048]`

### 2. Test Reply Detection
```bash
# Manually test ticket number extraction
node -e "
const subject = 'RE: VPN issue [Ticket #IT000048]';
const match = subject.match(/\[Ticket #(IT\\d+)\]/i);
console.log('Ticket Number:', match ? match[1] : 'Not found');
"
```

### 3. Test Reply Comment Addition
```bash
curl -X POST http://localhost:3011/api/tickets/add-reply-comment \
  -H "Content-Type: application/json" \
  -d '{
    "ticketNumber": "IT000048",
    "emailFrom": "user@example.com",
    "emailBody": "Thank you! This fixed my issue.",
    "emailSubject": "RE: VPN issue [Ticket #IT000048]"
  }'
```

### 4. Send Actual Reply
1. As requester, reply to the email
2. Add message: "Thank you, this worked!"
3. Wait for n8n to process (check workflow execution)
4. Check ticket IT000048 for new comment
5. Verify comment shows "Email Reply:" prefix

## Monitoring

### Check n8n Logs
```bash
docker logs n8n-aidin 2>&1 | grep -i "ticket\|reply"
```

### Check Helpdesk Logs
```bash
npx pm2 logs aidin-helpdesk | grep -i "reply\|comment"
```

### Query Recent Comments
```sql
-- Recent email reply comments
SELECT
  t.ticketNumber,
  tc.content,
  u.email,
  tc.createdAt
FROM ticket_comments tc
JOIN tickets t ON tc.ticketId = t.id
JOIN users u ON tc.userId = u.id
WHERE tc.content LIKE '%Email Reply:%'
ORDER BY tc.createdAt DESC
LIMIT 10;
```

## Workflow Diagram

```
Email Received
     ↓
Extract Ticket Number
     ↓
Is This A Reply?
     ├─ YES → Add Reply Comment → Done
     └─ NO  → Build AI Request → Create New Ticket
```

## Subject Line Patterns

### Supported Patterns
- ✅ `RE: Subject [Ticket #IT000048]`
- ✅ `Re: Subject [Ticket #IT000048]`
- ✅ `RE: RE: Subject [Ticket #IT000048]`
- ✅ `FW: RE: Subject [Ticket #IT000048]`

### Regex Pattern
```javascript
/\[Ticket #(IT\d+)\]/i
```

## Edge Cases

### Multiple Tickets in Subject
If subject contains multiple ticket numbers:
```
RE: Issue [Ticket #IT000048] and [Ticket #IT000050]
```
**Behavior**: Uses first match (IT000048)

### Ticket Number Not Found
If extraction fails:
- Creates new ticket (normal workflow)
- Logs warning for review

### Wrong Ticket Number
If ticket number doesn't exist:
- API returns 404
- n8n workflow should log error
- Consider creating new ticket or forwarding to staff

### Reply from Different Email
If reply comes from email different than requester:
- Still adds comment
- Logs warning
- Staff can review if needed

## Troubleshooting

### Subject Line Missing Ticket Number
1. Check EmailService.js line 78
2. Verify ticket object has `ticketNumber` property
3. Check email logs for actual subject sent

### Replies Creating New Tickets
1. Verify n8n workflow has "Extract Ticket Number" node
2. Check regex pattern matches your format
3. Review n8n execution logs

### Comments Not Added
1. Verify API endpoint exists: `/api/tickets/add-reply-comment`
2. Check ticket number is valid
3. Verify user/requester exists in database

## Future Enhancements

- [ ] Support conversation threading without ticket number
- [ ] Auto-detect replies using Message-ID headers
- [ ] Handle forwarded emails
- [ ] Thread multiple related tickets
- [ ] Rich text email parsing (preserve formatting)
- [ ] Attachment handling in replies

## Support

For questions or issues:
- **Email**: helpdesk@surterreproperties.com
- **Documentation**: `/opt/apps/aidin/docs/`
- **Logs**: `npx pm2 logs aidin-helpdesk`
