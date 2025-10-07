# Email Sending Investigation & Fix - October 7, 2025

## Problem Reported
User reported: "I haven't received any AI responses at jgodoymedina@icloud.com, which is the address I used to create the tickets, despite multiple attempts."

## Root Cause Analysis

### Issue 1: Missing emailConversationId
All existing tickets (including IT000067) have `emailConversationId` = NULL because the n8n workflow was not sending this field when creating tickets.

**Why emails weren't sent:**
```javascript
// In EmailService.js line 33:
if (!ticket.emailConversationId) {
  console.log('Ticket was not created from email, skipping email reply')
  return { skipped: true, reason: 'Not an email ticket' }
}
```

### Issue 2: Wrong n8n Workflow Active
- The workflow I updated earlier ("Email to Ticket - With Forward(1)") was **INACTIVE**
- The active workflow ("Email to Ticket - With Forward") did NOT have the conversationId fix
- n8n was using the old workflow without the fix

## Fixes Applied

### 1. Added Explicit Logging
Added clear log messages to show when and why emails are being skipped:

**File**: `/opt/apps/aidin/app/api/tickets/[id]/send-draft/route.js`

```javascript
if (ticket.emailConversationId && ticket.requester?.email) {
  console.log(`📧 Sending email response for ticket ${ticket.ticketNumber} to ${ticket.requester.email}...`)
  // ... send email ...
  console.log(`✅ AI response email sent for ticket ${ticket.ticketNumber}`)
} else {
  if (!ticket.emailConversationId) {
    console.log(`⚠️  Email NOT sent for ticket ${ticket.ticketNumber}: No emailConversationId`)
  } else if (!ticket.requester?.email) {
    console.log(`⚠️  Email NOT sent for ticket ${ticket.ticketNumber}: No requester email`)
  }
}
```

### 2. Activated Updated Workflow
Switched from old workflow to the fixed workflow:

```bash
# Deactivate old workflow
UPDATE workflow_entity SET active = 0 WHERE name = 'Email to Ticket - With Forward';

# Activate updated workflow (with conversationId fix)
UPDATE workflow_entity SET active = 1 WHERE name = 'Email to Ticket - With Forward(1)';
```

### 3. Restarted Services
- Restarted helpdesk application: `npx pm2 restart aidin-helpdesk`
- Restarted n8n: `docker compose restart n8n`

## What's Fixed Now

### ✅ Future Tickets (New Emails)
- New emails processed by n8n will have `emailConversationId` saved
- Staff can send AI responses and requesters WILL receive emails
- Email threading will work properly with ticket number in subject

### ❌ Existing Tickets (Created Before Fix)
- Tickets created before this fix (like IT000033, IT000067) still have NULL `emailConversationId`
- These tickets CANNOT send email replies automatically
- **Workaround**: Staff must manually copy the AI response and email the requester

## Testing Instructions

### Test 1: Send New Email
1. **Send an email** from jgodoymedina@icloud.com to helpdesk@surterreproperties.com
   - Subject: "Test email reply - [Your Name]"
   - Body: "Testing the new email reply system"

2. **Wait 1-2 minutes** for n8n to process

3. **Check the ticket** was created:
   ```bash
   sqlite3 /opt/apps/aidin/prisma/dev.db \
     "SELECT ticketNumber, title, emailConversationId
      FROM tickets
      ORDER BY createdAt DESC LIMIT 1;"
   ```

4. **Verify** `emailConversationId` is NOT NULL

5. **Open ticket** in helpdesk UI

6. **Send AI response** to requester

7. **Check logs**:
   ```bash
   npx pm2 logs aidin-helpdesk --lines 50 | grep -i "email"
   ```

8. **Verify email received** at jgodoymedina@icloud.com

### Test 2: Check Logs
Monitor real-time to see email sending:
```bash
npx pm2 logs aidin-helpdesk --lines 0 | grep --line-buffered -i "email\|sent\|skip"
```

### Test 3: Verify n8n Workflow
Check n8n is using the correct workflow:
```bash
sqlite3 /var/lib/docker/volumes/aidin_n8n_data/_data/database.sqlite \
  "SELECT name, active FROM workflow_entity WHERE name LIKE '%Email to Ticket%';"
```

Expected result:
```
Email to Ticket - With Forward|0
Email to Ticket - With Forward(1)|1   <-- This should be active (1)
```

## Monitoring Commands

### Check Recent Tickets with ConversationId
```bash
sqlite3 /opt/apps/aidin/prisma/dev.db "
SELECT
  ticketNumber,
  SUBSTR(title, 1, 30) as title,
  CASE
    WHEN emailConversationId IS NULL THEN 'NULL'
    ELSE 'SET'
  END as has_conv_id,
  datetime(createdAt/1000, 'unixepoch') as created
FROM tickets
WHERE source = 'email'
ORDER BY createdAt DESC
LIMIT 10;
"
```

### Check Email Sending Logs
```bash
# See successful email sends
npx pm2 logs aidin-helpdesk --nostream --lines 100 | grep "✅.*email sent"

# See skipped emails
npx pm2 logs aidin-helpdesk --nostream --lines 100 | grep "⚠️.*Email NOT sent"

# See email sending attempts
npx pm2 logs aidin-helpdesk --nostream --lines 100 | grep "📧 Sending email"
```

### Check n8n Logs
```bash
# See n8n email processing
docker logs aidin-n8n-1 --tail 100 2>&1 | grep -i "email\|ticket"
```

## Timeline of Events

| Time | Event |
|------|-------|
| ~4 hours ago | n8n workflow updated with conversationId in file |
| ~3 hours ago | Workflow imported into n8n |
| ~2 hours ago | n8n restarted, but WRONG workflow was active |
| ~1 hour ago | Tickets IT000033, IT000067 created (no conversationId) |
| ~1 hour ago | User tried to send AI responses (emails skipped silently) |
| Now | Added logging to show why emails are skipped |
| Now | Activated correct workflow with conversationId fix |
| Now | Restarted n8n and helpdesk application |
| **Next** | **User needs to send test email to verify fix** |

## Expected Behavior After Fix

### New Email Arrives
1. n8n polls Microsoft Graph every 1 minute
2. Gets unread emails from helpdesk@surterreproperties.com
3. For each email:
   - Extracts `email.id` (messageId)
   - Extracts `email.conversationId` ✅ **NEW**
   - Classifies with AI
   - Creates ticket with both fields
4. Ticket is created in database with `emailConversationId` populated

### Staff Sends AI Response
1. Staff clicks "Send to Requester"
2. System checks: `if (ticket.emailConversationId && ticket.requester?.email)`
3. Condition passes ✅
4. Email sent via Microsoft Graph API
5. Subject includes ticket number: `[Ticket #IT000XXX]`
6. Requester receives email

### Requester Replies
1. Reply email has ticket number in subject
2. n8n can extract ticket number and add as comment
3. (This requires additional n8n workflow update - see EMAIL-REPLY-THREADING.md)

## Files Modified

1. `/opt/apps/aidin/app/api/tickets/[id]/send-draft/route.js` - Added logging
2. `/opt/apps/aidin/n8n-workflows/Email to Ticket - With Forward(1).json` - Added conversationId
3. `/var/lib/docker/volumes/aidin_n8n_data/_data/database.sqlite` - Activated workflow

## Related Documentation

- `/opt/apps/aidin/docs/FIX-EMAIL-CONVERSATION-ID.md` - Original fix documentation
- `/opt/apps/aidin/docs/EMAIL-REPLY-THREADING.md` - Email threading feature
- `/opt/apps/aidin/docs/AUTO-ASSIGN-ON-SEND.md` - Auto-assign feature

## Next Steps

**REQUIRED**: User must send a test email to verify the fix is working:
1. Send email from jgodoymedina@icloud.com to helpdesk@surterreproperties.com
2. Wait for ticket creation
3. Send AI response
4. Confirm email is received

If email is still not received, check:
- n8n logs for errors
- Helpdesk logs for "Email NOT sent" messages
- Database to confirm emailConversationId is populated
- Microsoft Graph API credentials are valid

## Status

- ✅ Logging added to show why emails are skipped
- ✅ Correct workflow activated
- ✅ n8n restarted
- ✅ Helpdesk restarted
- ⏳ **Waiting for user to send test email**
- ⏳ **Waiting for confirmation that email is received**

## Date Fixed
October 7, 2025
