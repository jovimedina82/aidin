# Auto-Assign Ticket on Send AI Response

## Overview
When a staff member sends an AI response to a requester, the ticket is automatically assigned to that staff member. This ensures clear ownership and accountability for ticket resolution.

## Feature Details

### What Happens When You Send an AI Response:
1. ✅ **Ticket is assigned** to the logged-in user who sent the response
2. ✅ **Status is updated** from NEW → OPEN (if it was NEW)
3. ✅ **AI draft is cleared** after being sent
4. ✅ **Comment is added** to the ticket history
5. ✅ **Email is sent** to the requester (if ticket came from email)
6. ✅ **KB article is created** automatically in the background

### Workflow Example:

**Before sending:**
- Ticket: IT000055
- Status: NEW
- Assignee: (Unassigned)
- AI Draft: Ready to send

**User clicks "Send to Requester":**
- System sends email to requester
- Creates comment with response
- **Assigns ticket to John (logged-in user)**
- **Updates status to OPEN**

**After sending:**
- Ticket: IT000055
- Status: OPEN
- Assignee: John
- Email: Sent to requester ✉️

## Implementation

### File Modified
`/opt/apps/aidin/app/api/tickets/[id]/send-draft/route.js`

### Code Changes
```javascript
// Clear the draft fields and assign ticket to the user who sent the response
const updatedTicket = await prisma.ticket.update({
  where: { id: ticketId },
  data: {
    aiDraftResponse: null,
    aiDraftGeneratedAt: null,
    aiDraftGeneratedBy: null,
    assigneeId: user.id,  // ✅ Assign to user who sent the response
    status: ticket.status === 'NEW' ? 'OPEN' : ticket.status,  // ✅ Update status to OPEN if it was NEW
    updatedAt: new Date()
  },
  // ... rest of the update
})
```

## Benefits

### 1. **Clear Ownership**
No confusion about who's handling the ticket. The person who responds is automatically responsible.

### 2. **Better Accountability**
Staff members know which tickets they've taken ownership of by sending responses.

### 3. **Improved Tracking**
Managers can see who's handling which tickets without manual assignment.

### 4. **Workflow Efficiency**
No need to manually assign tickets before or after sending responses.

### 5. **Status Consistency**
Tickets automatically move from NEW to OPEN when first response is sent.

## Status Transitions

| Current Status | After Sending Response |
|---------------|----------------------|
| NEW           | OPEN                |
| OPEN          | OPEN                |
| PENDING       | PENDING             |
| RESOLVED      | RESOLVED            |
| CLOSED        | CLOSED              |

**Note**: Only NEW tickets are automatically moved to OPEN. All other statuses remain unchanged.

## Edge Cases

### Unassigned Tickets
- Any staff member can send the AI response
- First person to send gets assigned
- Ticket moves to OPEN status

### Already Assigned Tickets
- Sending response **reassigns** to the sender
- Useful if another staff member takes over
- Previous assignee is replaced

### Multiple Staff Members
- If multiple staff work on a ticket, the last person to send a response becomes the assignee
- Consider adding a comment before sending if you're taking over

## Testing

To verify the feature:

1. **Find an unassigned NEW ticket**
2. **Click "Send to Requester"**
3. **Verify**:
   - Ticket is assigned to you
   - Status changed to OPEN
   - Email sent to requester
   - Comment added to ticket

## Monitoring

Check ticket assignments:
```bash
# Recently assigned tickets
sqlite3 /opt/apps/aidin/prisma/dev.db "
SELECT
  t.ticketNumber,
  t.status,
  u.firstName || ' ' || u.lastName as assignee,
  t.updatedAt
FROM tickets t
LEFT JOIN users u ON t.assigneeId = u.id
WHERE t.updatedAt >= datetime('now', '-1 hour')
ORDER BY t.updatedAt DESC
LIMIT 10;
"
```

## Related Features

- **Email Reply Threading** - Ticket number in subject for replies
- **"Not a Ticket?" Button** - Mark false positive tickets
- **Auto KB Creation** - Automatically create knowledge base articles from responses
- **AI Draft Generation** - AI generates initial response drafts

## Date Implemented
October 7, 2025

## Requested By
User Request: "when I click in send the AI response also assign the ticket automatically to the user that is logged in."
