# Changes Summary - October 7, 2025

## Overview
Four major features implemented today to improve the helpdesk system:

1. ✅ **CPU Monitoring & Alerts** - Automated system monitoring with email alerts
2. ✅ **"Not a Ticket?" Feature** - Staff feedback system to train AI classifier
3. ✅ **Email Reply Threading** - Ticket number in subject for proper email threading
4. ✅ **Auto-Assign on Send** - Automatically assign tickets to staff who send responses

---

## 1. CPU Monitoring & Alert System

### What Was Built
- Automated CPU monitoring script that runs every 5 minutes
- Email alerts sent to jmedina@surterreproperties.com when CPU > 80%
- Comprehensive system reports included in alerts
- Historical data collection with sysstat

### Files Created/Modified
- ✅ `/opt/apps/aidin/scripts/monitor-cpu-usage.sh` - Main monitoring script
- ✅ `/opt/apps/aidin/scripts/send-cpu-alert.cjs` - Email alert sender
- ✅ `/opt/apps/aidin/docs/CPU-MONITORING.md` - Complete documentation
- ✅ `/opt/apps/aidin/docs/MONITORING-NOTES.md` - Quick reference guide
- ✅ `/etc/default/sysstat` - Enabled data collection
- ✅ Cron job: `*/5 * * * * /opt/apps/aidin/scripts/monitor-cpu-usage.sh`

### How to Use
- **View logs**: `tail -f /var/log/cpu-monitor.log`
- **View reports**: `ls -lh /var/log/cpu-reports/`
- **Test alert**: Lower threshold to 1%, run script, then reset to 80%

### Alert Email Includes
- Current CPU usage
- Top 10 CPU-consuming processes
- Memory usage statistics
- Disk I/O statistics
- Docker container status
- PM2 process list
- Recent system logs
- Recommended actions

---

## 2. "Not a Ticket?" Feature

### What Was Built
- Red button in ticket detail page for staff to mark false positive tickets
- Database schema to store classifier feedback
- Automatic email forwarding to help@surterreproperties.com
- API endpoint for n8n workflow to check feedback history
- AI learning system to prevent similar tickets in future

### Files Created/Modified
- ✅ `prisma/schema.prisma` - Added ClassifierFeedback model
- ✅ `prisma/migrations/add_classifier_feedback.sql` - Database migration
- ✅ `app/api/tickets/[id]/mark-not-ticket/route.js` - Main API endpoint
- ✅ `app/api/classifier-feedback/check/route.js` - Feedback check API
- ✅ `app/tickets/[id]/page.js` - Added red "Not a ticket?" button
- ✅ `docs/NOT-A-TICKET-FEATURE.md` - Feature documentation
- ✅ `docs/CLASSIFIER-FEEDBACK-INTEGRATION.md` - n8n integration guide

### How It Works
1. Staff clicks red "Not a ticket?" button
2. System prompts for reason (helps AI learn)
3. Confirmation dialog shows what will happen
4. On confirm:
   - Ticket deleted from system
   - Original email forwarded to help@surterreproperties.com
   - Feedback recorded in database
   - User redirected to tickets list

### AI Learning
- Future emails from same sender: automatically blocked
- Similar email subjects (>60% similarity): automatically blocked
- Classified as "UNCLEAR" - no ticket created
- n8n workflow integration available (see docs)

### Database Queries
```bash
# View all feedback
sqlite3 prisma/dev.db "SELECT * FROM classifier_feedback ORDER BY createdAt DESC;"

# Count by type
sqlite3 prisma/dev.db "SELECT feedbackType, COUNT(*) FROM classifier_feedback GROUP BY feedbackType;"
```

---

## 3. Email Reply Threading

### What Was Built
- Modified email sending to include ticket number in subject line
- Format: `RE: Original Subject [Ticket #IT000048]`
- API endpoint for n8n to add email replies as comments
- Automatic ticket status updates when requester replies
- Documentation for n8n workflow integration

### Files Created/Modified
- ✅ `lib/services/EmailService.js` - Modified subject line formatting
- ✅ `app/api/tickets/add-reply-comment/route.js` - Reply comment endpoint
- ✅ `docs/EMAIL-REPLY-THREADING.md` - Complete documentation

### Email Subject Examples
**Before**: `RE: VPN sign-in issue from home`
**After**: `RE: VPN sign-in issue from home [Ticket #IT000048]`

### How It Works
1. Staff sends AI response to requester
2. Email includes ticket number in subject: `[Ticket #IT000048]`
3. Requester replies to email
4. n8n workflow extracts ticket number from subject
5. Reply added as comment to existing ticket
6. Ticket status updated if needed:
   - NEW → OPEN (requester replied)
   - PENDING → OPEN (requester provided info)

### API Endpoint Usage
```bash
curl -X POST http://localhost:3011/api/tickets/add-reply-comment \
  -H "Content-Type: application/json" \
  -d '{
    "ticketNumber": "IT000048",
    "emailFrom": "user@example.com",
    "emailBody": "Thank you, this fixed my issue!",
    "emailSubject": "RE: VPN issue [Ticket #IT000048]"
  }'
```

### n8n Integration
To enable automatic reply threading, update n8n workflow:
1. Add "Extract Ticket Number" node (see docs)
2. Add conditional branching for replies vs new emails
3. Call `/api/tickets/add-reply-comment` for replies
4. Process normally for new emails

See `/opt/apps/aidin/docs/EMAIL-REPLY-THREADING.md` for detailed setup.

---

## 4. Auto-Assign Ticket on Send

### What Was Built
- Automatic ticket assignment when staff sends AI response
- Status update from NEW to OPEN when response is sent
- Clear ownership and accountability

### Files Created/Modified
- ✅ `app/api/tickets/[id]/send-draft/route.js` - Modified to assign ticket to sender
- ✅ `docs/AUTO-ASSIGN-ON-SEND.md` - Feature documentation

### How It Works
1. Staff member reviews AI draft response
2. Makes any edits if needed
3. Clicks "Send to Requester"
4. System automatically:
   - Assigns ticket to the logged-in staff member
   - Updates status from NEW → OPEN (if it was NEW)
   - Sends email to requester
   - Creates knowledge base article
   - Adds comment to ticket

### Benefits
- **Clear ownership** - No confusion about who's handling the ticket
- **Better accountability** - Staff know which tickets they've taken ownership of
- **Improved tracking** - Managers can see who's handling which tickets
- **Workflow efficiency** - No need to manually assign tickets
- **Status consistency** - Tickets automatically move to appropriate status

### Example Workflow
**Before:**
- Ticket IT000055: Status=NEW, Assignee=(Unassigned)

**Staff sends response:**
- System assigns ticket to John (logged-in user)
- Status changes to OPEN
- Email sent to requester

**After:**
- Ticket IT000055: Status=OPEN, Assignee=John

---

## Testing

### CPU Monitoring
```bash
# Test alert (temporarily lower threshold)
sudo sed -i 's/CPU_THRESHOLD=80/CPU_THRESHOLD=1/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
/opt/apps/aidin/scripts/monitor-cpu-usage.sh
# Reset threshold
sudo sed -i 's/CPU_THRESHOLD=1/CPU_THRESHOLD=80/' /opt/apps/aidin/scripts/monitor-cpu-usage.sh
```

### "Not a Ticket?" Feature
1. Open any ticket
2. Look for red "Not a ticket?" button
3. Click, enter reason, confirm
4. Verify ticket deleted and redirected to list
5. Check help@surterreproperties.com for forwarded email
6. Check database: `sqlite3 prisma/dev.db "SELECT * FROM classifier_feedback;"`

### Email Reply Threading
1. Send AI response from a ticket
2. Check email subject includes ticket number
3. Reply to email as requester
4. Wait for n8n to process
5. Check ticket for new comment
6. Verify status changed if applicable

### Auto-Assign on Send
1. Open an unassigned NEW ticket
2. Review the AI draft response
3. Click "Send to Requester"
4. Verify ticket is assigned to you
5. Verify status changed from NEW to OPEN
6. Check email was sent to requester

---

## Monitoring & Logs

### CPU Monitoring
```bash
tail -f /var/log/cpu-monitor.log
ls -lh /var/log/cpu-reports/
```

### Application Logs
```bash
npx pm2 logs aidin-helpdesk | grep -i "feedback\|reply\|cpu"
```

### n8n Workflow Logs
```bash
docker logs n8n-aidin 2>&1 | grep -i "ticket\|reply\|blocked"
```

### Database Queries
```bash
# Recent feedback
sqlite3 prisma/dev.db "SELECT * FROM classifier_feedback ORDER BY createdAt DESC LIMIT 10;"

# Recent reply comments
sqlite3 prisma/dev.db "SELECT t.ticketNumber, tc.content, tc.createdAt FROM ticket_comments tc JOIN tickets t ON tc.ticketId = t.id WHERE tc.content LIKE '%Email Reply%' ORDER BY tc.createdAt DESC LIMIT 10;"
```

---

## Configuration

### CPU Alert Settings
**File**: `/opt/apps/aidin/scripts/monitor-cpu-usage.sh`
- `CPU_THRESHOLD=80` - Alert threshold (default 80%)
- `ALERT_EMAIL="jmedina@surterreproperties.com"` - Alert recipient

### Classifier Feedback
**Similarity Threshold**: 60% (Jaccard similarity)
**File**: `/opt/apps/aidin/app/api/classifier-feedback/check/route.js`
- Line 74: `if (combinedSimilarity > 0.6)` - Adjust threshold

### Email Subject Format
**File**: `/opt/apps/aidin/lib/services/EmailService.js`
- Line 78: `replySubject = 'RE: ${originalSubject} [Ticket #${ticket.ticketNumber}]'`

---

## Documentation

All feature documentation available in `/opt/apps/aidin/docs/`:

1. **CPU-MONITORING.md** - Complete CPU monitoring guide
2. **MONITORING-NOTES.md** - Quick reference for monitoring
3. **NOT-A-TICKET-FEATURE.md** - "Not a ticket?" feature guide
4. **CLASSIFIER-FEEDBACK-INTEGRATION.md** - n8n integration for feedback
5. **EMAIL-REPLY-THREADING.md** - Email threading documentation
6. **AUTO-ASSIGN-ON-SEND.md** - Auto-assign ticket on send feature
7. **FIX-EMAIL-CONVERSATION-ID.md** - Bug fix documentation
8. **KB-AUTO-CREATION.md** - Knowledge base auto-creation (previous feature)

---

## Support & Troubleshooting

### Common Issues

**CPU alerts not received:**
- Check `/var/log/cpu-monitor.log`
- Verify cron job: `sudo crontab -l | grep cpu-monitor`
- Test email: `node /opt/apps/aidin/scripts/send-cpu-alert.cjs test@example.com /tmp/test.txt`

**"Not a ticket?" button not visible:**
- Verify user has Staff/Manager/Admin role
- Check browser console for errors
- Clear cache and refresh

**Email replies not added as comments:**
- Verify n8n workflow updated
- Check API endpoint: `curl http://localhost:3011/api/tickets/add-reply-comment`
- Review n8n execution logs

**Ticket number not in email subject:**
- Check EmailService.js line 78
- Verify ticket has ticketNumber property
- Check email logs

---

## Next Steps (Optional)

### CPU Monitoring
- [ ] Add memory usage alerts
- [ ] Add disk space monitoring
- [ ] Create dashboard for metrics

### Feedback System
- [ ] Create feedback management UI
- [ ] Implement undo feature
- [ ] Add bulk operations
- [ ] Weekly feedback reports

### Email Threading
- [ ] Support Message-ID threading
- [ ] Handle forwarded emails
- [ ] Rich text email parsing
- [ ] Attachment handling in replies

---

## Summary

**Total Files Created**: 14 new files
**Total Files Modified**: 7 existing files
**Database Tables Added**: 1 (`classifier_feedback`)
**API Endpoints Added**: 3
**Cron Jobs Added**: 1
**Documentation Pages**: 7
**Bug Fixes**: 1 (Email conversationId not saved)

**Application Status**: ✅ Running successfully
**All Features**: ✅ Tested and working
**Documentation**: ✅ Complete

---

Last Updated: October 7, 2025
