# "Not a Ticket?" Feature - Implementation Summary

## Overview
A complete feedback system that allows staff to mark tickets as "not a ticket", helping the AI learn and preventing similar emails from creating tickets in the future.

## What Was Implemented

### 1. Database Schema ✅
**File**: `prisma/schema.prisma` + `prisma/migrations/add_classifier_feedback.sql`

Created `classifier_feedback` table to store staff feedback:
- Tracks which emails were incorrectly classified as tickets
- Stores email details (from, subject, body)
- Records staff member who provided feedback
- Captures reason for marking as "not a ticket"

```sql
CREATE TABLE classifier_feedback (
  id TEXT PRIMARY KEY,
  ticketId TEXT NOT NULL,
  emailFrom TEXT,
  emailSubject TEXT,
  emailBody TEXT,
  originalCategory TEXT,
  feedbackType TEXT NOT NULL, -- 'NOT_TICKET', 'WRONG_CATEGORY', 'CORRECT'
  correctCategory TEXT,
  reason TEXT,
  userId TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. API Endpoints ✅

#### `/api/tickets/[id]/mark-not-ticket` (POST)
**File**: `app/api/tickets/[id]/mark-not-ticket/route.js`

**What it does**:
1. ✅ Records feedback in `classifier_feedback` table
2. ✅ Forwards original email to help@surterreproperties.com
3. ✅ Deletes ticket from the system
4. ✅ Logs all actions for audit trail

**Response**:
```json
{
  "success": true,
  "message": "Ticket marked as not a ticket, feedback recorded, and email forwarded",
  "feedback": {
    "id": "uuid",
    "feedbackType": "NOT_TICKET",
    "ticketNumber": "IT000048"
  }
}
```

#### `/api/classifier-feedback/check` (POST)
**File**: `app/api/classifier-feedback/check/route.js`

**What it does**:
1. ✅ Checks if email sender matches previous "NOT_TICKET" feedback (exact match)
2. ✅ Checks if email subject is similar to previous "NOT_TICKET" feedback (>60% similarity)
3. ✅ Returns whether to block ticket creation

**Request**:
```json
{
  "emailFrom": "sender@example.com",
  "emailSubject": "Subject line",
  "emailBody": "Email body preview"
}
```

**Response**:
```json
{
  "shouldBlock": true,
  "reason": "Sender previously marked as not a ticket",
  "feedbackId": "uuid",
  "matchType": "exact_sender"
}
```

### 3. User Interface ✅

#### "Not a ticket?" Button
**File**: `app/tickets/[id]/page.js`

**Location**: Ticket detail page, staff actions section

**Appearance**:
- Red outline button with XCircle icon
- Only visible to staff/admin users
- Always visible (not conditional)

**User Flow**:
1. Staff clicks "Not a ticket?" button
2. Prompt asks for reason (optional but helpful for AI learning)
3. Confirmation dialog explains what will happen:
   - Delete ticket #[number]
   - Forward email to help@surterreproperties.com
   - Help train AI to avoid similar classifications
   - Action cannot be undone
4. On confirmation:
   - Feedback recorded
   - Email forwarded
   - Ticket deleted
   - User redirected to tickets list
   - Success toast notification

### 4. AI Learning Integration ✅
**Documentation**: `docs/CLASSIFIER-FEEDBACK-INTEGRATION.md`

**How it works**:
1. n8n workflow receives new email
2. Before classifying, calls `/api/classifier-feedback/check`
3. If feedback exists for similar emails:
   - Email classified as "UNCLEAR"
   - No ticket created
   - Logged for review
4. If no matching feedback:
   - Normal AI classification proceeds
   - Ticket created if appropriate

**Similarity Detection**:
- **Exact match**: Same email address as previous "NOT_TICKET"
- **Similar subject**: Jaccard similarity >60% (word overlap)
- **Combined score**: Weighted average of subject (70%) and body (30%) similarity

## How to Use

### For Staff Members

#### Mark a Ticket as "Not a Ticket":
1. Open the ticket that shouldn't exist
2. Click the red "Not a ticket?" button
3. Enter a reason (helps AI learn): "This is a marketing email, not a support request"
4. Confirm the action
5. Ticket will be deleted and email forwarded

#### What Happens Next:
- Original email forwarded to help@surterreproperties.com
- AI learns to avoid similar emails in the future
- Future emails from same sender or with similar subject won't create tickets

### For n8n Workflow Configuration

**To integrate with n8n** (optional but recommended):

1. Add new HTTP Request node before "Build AI Request"
2. Configure:
   - **Method**: POST
   - **URL**: `http://localhost:3011/api/classifier-feedback/check`
   - **Body**:
   ```json
   {
     "emailFrom": "{{ $json.from.emailAddress.address }}",
     "emailSubject": "{{ $json.subject }}",
     "emailBody": "{{ $json.bodyPreview }}"
   }
   ```
3. Update "Build AI Request" to check `shouldBlock` flag
4. Skip ticket creation if blocked

**See**: `docs/CLASSIFIER-FEEDBACK-INTEGRATION.md` for detailed n8n setup

## Database Queries

### View All Feedback:
```bash
sqlite3 /opt/apps/aidin/prisma/dev.db \
  "SELECT * FROM classifier_feedback ORDER BY createdAt DESC LIMIT 10;"
```

### Count by Feedback Type:
```sql
SELECT feedbackType, COUNT(*) as count
FROM classifier_feedback
GROUP BY feedbackType;
```

### Recent "NOT_TICKET" Feedback:
```sql
SELECT
  emailFrom,
  emailSubject,
  reason,
  datetime(createdAt/1000, 'unixepoch') as created
FROM classifier_feedback
WHERE feedbackType = 'NOT_TICKET'
ORDER BY createdAt DESC
LIMIT 20;
```

### Feedback by Staff Member:
```sql
SELECT
  u.firstName || ' ' || u.lastName as staff_name,
  COUNT(*) as feedback_count
FROM classifier_feedback cf
JOIN users u ON cf.userId = u.id
GROUP BY cf.userId
ORDER BY feedback_count DESC;
```

## Testing

### Test the "Not a Ticket?" Feature:

1. **Create a test ticket** (or use existing)
2. **Open the ticket** in the UI
3. **Look for red button** labeled "Not a ticket?" in staff actions
4. **Click the button**
5. **Enter reason**: "Test - checking feedback system"
6. **Confirm deletion**
7. **Verify**:
   - Ticket disappears from list
   - Redirected to tickets page
   - Success message appears

### Test Feedback API:

```bash
# Test feedback check (should return shouldBlock: false initially)
curl -X POST http://localhost:3011/api/classifier-feedback/check \
  -H "Content-Type: application/json" \
  -d '{
    "emailFrom": "test@example.com",
    "emailSubject": "Test Email Subject",
    "emailBody": "Test email body content"
  }'
```

### Verify Email Forwarding:

1. Mark a ticket as "not a ticket"
2. Check help@surterreproperties.com inbox
3. Look for forwarded email with subject: "FWD: [original subject] [Not a Ticket]"
4. Email should include:
   - Original email details
   - Ticket number that was deleted
   - Staff member who marked it
   - Reason provided

## Monitoring

### Check System Logs:

```bash
# Check helpdesk logs
npx pm2 logs aidin-helpdesk --lines 50 | grep -i "feedback\|not a ticket"

# Check for blocked emails
grep "BLOCKED" /var/log/*.log
```

### View Feedback Activity:

```bash
# Count total feedback entries
sqlite3 /opt/apps/aidin/prisma/dev.db \
  "SELECT COUNT(*) FROM classifier_feedback;"

# View today's feedback
sqlite3 /opt/apps/aidin/prisma/dev.db \
  "SELECT * FROM classifier_feedback
   WHERE date(createdAt/1000, 'unixepoch') = date('now')
   ORDER BY createdAt DESC;"
```

## Files Changed/Created

### Database:
- ✅ `prisma/schema.prisma` - Added ClassifierFeedback model
- ✅ `prisma/migrations/add_classifier_feedback.sql` - Migration script

### API Routes:
- ✅ `app/api/tickets/[id]/mark-not-ticket/route.js` - Mark ticket as not a ticket
- ✅ `app/api/classifier-feedback/check/route.js` - Check feedback for email

### UI Components:
- ✅ `app/tickets/[id]/page.js` - Added "Not a ticket?" button and handler

### Documentation:
- ✅ `docs/NOT-A-TICKET-FEATURE.md` - This file
- ✅ `docs/CLASSIFIER-FEEDBACK-INTEGRATION.md` - n8n integration guide

## Benefits

### 1. Reduces False Positives
- Staff can quickly remove incorrectly created tickets
- Prevents ticket backlog pollution
- Improves ticket metrics accuracy

### 2. AI Learning
- System learns from staff feedback
- Future similar emails automatically blocked
- Classification accuracy improves over time

### 3. Proper Email Routing
- Non-ticket emails forwarded to help@surterreproperties.com
- Ensures important emails aren't lost
- Handled through proper channels

### 4. Audit Trail
- All feedback recorded in database
- Track which staff provide feedback
- Review patterns and trends

## Future Enhancements

- [ ] **Feedback Dashboard**: UI to view and manage all feedback
- [ ] **Undo Feature**: Ability to reverse "not a ticket" marking
- [ ] **Bulk Operations**: Mark multiple tickets at once
- [ ] **ML-Based Similarity**: Use vector embeddings for better matching
- [ ] **Domain Blacklist**: Auto-block entire domains after repeated feedback
- [ ] **Weekly Reports**: Summary of feedback and blocked emails
- [ ] **Confidence Scoring**: Weight feedback by staff experience
- [ ] **Pattern Detection**: Automatically identify common false positive patterns

## Troubleshooting

### Button Not Visible
- Verify user has Staff, Manager, or Admin role
- Check browser console for JavaScript errors
- Clear browser cache and refresh

### Ticket Not Deleted
- Check console logs: `npx pm2 logs aidin-helpdesk`
- Verify database connection
- Check for related data (comments, attachments) preventing deletion

### Email Not Forwarded
- Verify EmailService configuration in `.env`
- Check Azure AD credentials
- Test with: `node scripts/send-cpu-alert.cjs test@example.com /tmp/test.txt`

### Feedback Not Blocking Future Emails
- Verify n8n workflow is updated (see integration docs)
- Check API endpoint is responding: `curl http://localhost:3011/api/classifier-feedback/check`
- Review similarity threshold (default 0.6)

## Support

For questions or issues:
- **Email**: helpdesk@surterreproperties.com
- **Documentation**: `/opt/apps/aidin/docs/`
- **Database**: `/opt/apps/aidin/prisma/dev.db`
- **Logs**: `npx pm2 logs aidin-helpdesk`
