# Classifier Feedback Integration with n8n

## Overview
This document explains how to integrate the classifier feedback system with the n8n email-to-ticket workflow to prevent creating tickets from emails that staff have marked as "not a ticket".

## Database Schema
The `classifier_feedback` table stores feedback from staff when they mark tickets as false positives:

```sql
CREATE TABLE "classifier_feedback" (
    "id" TEXT PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "emailFrom" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "originalCategory" TEXT,
    "feedbackType" TEXT NOT NULL, -- 'NOT_TICKET', 'WRONG_CATEGORY', 'CORRECT'
    "correctCategory" TEXT,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## How It Works

### 1. Staff Marks Ticket as "Not a Ticket"
When staff clicks the red "Not a ticket?" button:
- Feedback is recorded in `classifier_feedback` table
- Original email is forwarded to help@surterreproperties.com
- Ticket is deleted from the system

### 2. n8n Workflow Checks Feedback
Before creating a new ticket, the workflow should:
- Query `classifier_feedback` for similar emails
- Check if sender email or subject matches previous "NOT_TICKET" feedback
- If match found, classify as "UNCLEAR" and skip ticket creation

### 3. Similar Email Detection
Emails are considered similar if:
- **Exact sender match**: Same email address as previous "NOT_TICKET"
- **Subject similarity**: Similar subject line (60%+ match)
- **Pattern match**: Similar patterns in subject or body

## n8n Workflow Updates

### Required Changes

Add a new node **"Check Feedback History"** between "Process Emails" and "Build AI Request":

#### Node Configuration:
- **Node Type**: HTTP Request
- **Position**: Before "Build AI Request" node
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

### API Endpoint to Create

Create `/opt/apps/aidin/app/api/classifier-feedback/check/route.js`:

```javascript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    const { emailFrom, emailSubject, emailBody } = await request.json()

    // Check for exact sender match
    const exactMatch = await prisma.classifierFeedback.findFirst({
      where: {
        feedbackType: 'NOT_TICKET',
        emailFrom: emailFrom
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (exactMatch) {
      return NextResponse.json({
        shouldBlock: true,
        reason: 'Sender previously marked as not a ticket',
        feedbackId: exactMatch.id
      })
    }

    // Check for similar subject (simple string similarity)
    const similarSubjects = await prisma.classifierFeedback.findMany({
      where: {
        feedbackType: 'NOT_TICKET',
        emailSubject: {
          not: null
        }
      },
      take: 50,
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Simple similarity check (can be improved with better algorithms)
    for (const feedback of similarSubjects) {
      const similarity = calculateSimilarity(
        emailSubject.toLowerCase(),
        feedback.emailSubject.toLowerCase()
      )

      if (similarity > 0.6) {
        return NextResponse.json({
          shouldBlock: true,
          reason: `Similar subject to previous "not a ticket" (${Math.round(similarity * 100)}% match)`,
          feedbackId: feedback.id,
          similarSubject: feedback.emailSubject
        })
      }
    }

    return NextResponse.json({
      shouldBlock: false,
      reason: 'No similar "not a ticket" feedback found'
    })

  } catch (error) {
    console.error('Error checking classifier feedback:', error)
    return NextResponse.json(
      { shouldBlock: false, error: error.message },
      { status: 500 }
    )
  }
}

function calculateSimilarity(str1, str2) {
  // Jaccard similarity (simple but effective)
  const words1 = new Set(str1.split(/\s+/))
  const words2 = new Set(str2.split(/\s+/))

  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}
```

### Workflow Logic Update

Update the **"Build AI Request"** node to check feedback:

```javascript
// At the beginning of the Build AI Request node:

// Check if feedback check blocked this email
const feedbackCheck = $input.first()?.json;
if (feedbackCheck?.shouldBlock === true) {
  // Force classification as UNCLEAR
  return {
    json: {
      class: "unclear",
      confidence: 0.9,
      reason: `Blocked by feedback system: ${feedbackCheck.reason}`,
      priority: "low",
      _feedbackBlocked: true,
      _originalEmail: email
    }
  };
}

// ... rest of the existing code
```

### Update "Parse AI Response" node

Add logic to skip ticket creation when `_feedbackBlocked` is true:

```javascript
// After parsing AI response:
if (result._feedbackBlocked === true) {
  console.log(`⛔ Email blocked by feedback: ${result.reason}`);
  return {
    json: {
      skip: true,
      reason: result.reason
    }
  };
}

// ... rest of the existing code
```

## Testing

### 1. Mark a Ticket as "Not a Ticket"
1. Open any ticket
2. Click "Not a ticket?" button (red)
3. Enter reason: "Test email - should not create ticket"
4. Confirm deletion

### 2. Send Similar Email
1. Send an email from the same address
2. Check n8n workflow execution
3. Verify it's classified as "UNCLEAR"
4. Verify no ticket is created

### 3. Check Logs
```bash
# Check n8n logs
docker logs n8n-aidin 2>&1 | grep -i "feedback\|blocked"

# Check helpdesk logs
npx pm2 logs aidin-helpdesk | grep -i "feedback"

# Query feedback database
sqlite3 /opt/apps/aidin/prisma/dev.db "SELECT * FROM classifier_feedback ORDER BY createdAt DESC LIMIT 10;"
```

## Monitoring

### View Feedback Stats
```sql
-- Count feedback by type
SELECT feedbackType, COUNT(*) as count
FROM classifier_feedback
GROUP BY feedbackType;

-- Recent "NOT_TICKET" feedback
SELECT
  emailFrom,
  emailSubject,
  reason,
  createdAt
FROM classifier_feedback
WHERE feedbackType = 'NOT_TICKET'
ORDER BY createdAt DESC
LIMIT 20;

-- Feedback by user
SELECT
  u.firstName || ' ' || u.lastName as staff_name,
  COUNT(*) as feedback_count
FROM classifier_feedback cf
JOIN users u ON cf.userId = u.id
GROUP BY cf.userId
ORDER BY feedback_count DESC;
```

## Maintenance

### Clear Old Feedback
Optionally clean up old feedback (keep last 90 days):

```sql
DELETE FROM classifier_feedback
WHERE createdAt < datetime('now', '-90 days');
```

### Export Feedback for Analysis
```bash
sqlite3 /opt/apps/aidin/prisma/dev.db -header -csv \
  "SELECT * FROM classifier_feedback" > feedback_export.csv
```

## Future Enhancements

- [ ] **ML-Based Similarity**: Use vector embeddings for better similarity matching
- [ ] **Confidence Scoring**: Weight feedback by staff rank or frequency
- [ ] **Pattern Learning**: Automatically identify common "not a ticket" patterns
- [ ] **Domain Blacklists**: Auto-block entire domains after repeated feedback
- [ ] **Feedback Dashboard**: UI to review and manage feedback
- [ ] **A/B Testing**: Compare ticket volume before/after feedback integration

## Troubleshooting

### Feedback Check Not Working
1. Verify API endpoint exists: `curl http://localhost:3011/api/classifier-feedback/check`
2. Check database table exists: `sqlite3 dev.db ".tables" | grep classifier_feedback`
3. Verify n8n workflow includes feedback check node
4. Check n8n node authentication is configured

### False Positives Still Creating Tickets
1. Check if feedback was actually recorded in database
2. Verify similarity threshold (default 0.6 may be too strict)
3. Check if exact sender match is working
4. Review n8n workflow execution logs

### Legitimate Tickets Being Blocked
1. Review feedback entries for that sender/subject
2. Adjust similarity threshold if needed
3. Delete incorrect feedback entries
4. Consider implementing an "unblock" feature

## Support

For questions or issues:
- **Email**: helpdesk@surterreproperties.com
- **Documentation**: `/opt/apps/aidin/docs/`
- **Database**: `/opt/apps/aidin/prisma/dev.db`
