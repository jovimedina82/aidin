# Multi-Email User System Documentation

## Overview
This feature allows users to have multiple email addresses linked to a single profile. When external emails (Gmail, Yahoo, etc.) create tickets, the system automatically links them to existing @surterreproperties.com accounts, preventing duplicate users and ensuring all notifications reach the user.

---

## Key Features

### 1. **Automatic Email Linking**
- When a ticket is created from an external email (e.g., `john.doe@gmail.com`)
- System searches for existing user with similar @surterreproperties.com email
- If found, automatically links the external email to that profile
- No duplicate users created

### 2. **Multi-Email Notifications**
- When comments are added to tickets
- Emails are sent to **ALL** verified email addresses for that user
- User receives notifications on both work and personal emails

### 3. **Primary Email from Microsoft Entra**
- User's official @surterreproperties.com email remains the primary contact
- All profile information comes from Microsoft Entra ID
- Alternate emails are additional contact points

---

## Database Schema

### New Table: `user_emails`

```sql
CREATE TABLE user_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_type TEXT DEFAULT 'alternate',  -- primary, alternate, personal, work
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by TEXT,  -- User ID who added this email
  verified_at TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX idx_user_emails_email ON user_emails(email);
```

---

## API Functions

### Core Utilities (`lib/user-email-utils.js`)

#### 1. `findUserByAnyEmail(email)`
Finds a user by any of their email addresses (primary or alternate).

```javascript
const user = await findUserByAnyEmail('john.doe@gmail.com')
// Returns user with john.doe@surterreproperties.com profile
```

#### 2. `linkExternalEmailToUser(externalEmail, addedBy)`
Automatically links external email to matching @surterreproperties.com user.

```javascript
const result = await linkExternalEmailToUser('john.doe@gmail.com', 'system')
// result = { user: User, linked: true, newEmail: true }
```

**Logic:**
- Extracts username from external email (e.g., "john.doe" from "john.doe@gmail.com")
- Searches for user with `john.doe@surterreproperties.com`
- Creates `UserEmail` record linking the two
- Auto-verifies the email (since it came from a real email)

#### 3. `getAllUserEmails(userId)`
Returns all verified email addresses for a user.

```javascript
const emails = await getAllUserEmails(userId)
// Returns: ['john.doe@surterreproperties.com', 'john.doe@gmail.com', 'jdoe@yahoo.com']
```

#### 4. `addAlternateEmail(userId, email, emailType, addedBy)`
Manually add an alternate email (from UI).

#### 5. `removeAlternateEmail(userEmailId, userId)`
Remove an alternate email.

#### 6. `verifyAlternateEmail(userEmailId)`
Mark an email as verified.

---

## Integration Points

### 1. **Ticket Creation (`app/api/tickets/route.js`)**

**Before:**
```javascript
// Only checked primary email
const requester = await prisma.user.findFirst({
  where: { email: data.requesterEmail.toLowerCase() }
})
```

**After:**
```javascript
// Checks ALL emails (primary + alternates)
const { findUserByAnyEmail, linkExternalEmailToUser } = await import('@/lib/user-email-utils')

let requester = await findUserByAnyEmail(data.requesterEmail)

if (!requester) {
  // Try to link external email to existing @surterreproperties.com user
  const linkResult = await linkExternalEmailToUser(data.requesterEmail, 'system')
  requester = linkResult.user

  if (linkResult.linked && linkResult.newEmail) {
    console.log(`✅ Linked external email ${data.requesterEmail} to user ${requester.email}`)
  }
}
```

### 2. **Email Notifications (`lib/email.js`)**

**Modified Functions:**
- `sendTicketCreatedEmail(ticket, requester)`
- `sendTicketCommentEmail(ticket, comment, user, requester, assignee)`
- `sendAIResponseEmail(ticket, comment, requester)`
- `sendTicketCreatedWithAIResponseEmail(ticket, aiComment, requester)`

**Changes:**
```javascript
// Get ALL email addresses for user
const { getAllUserEmails } = await import('./user-email-utils.js')
const allEmails = await getAllUserEmails(requester.id)

if (allEmails.length === 0) {
  allEmails.push(requester.email) // Fallback
}

// Send to ALL emails
await sendEmail({
  from: getFromAddress(),
  to: allEmails.join(', '),  // Multiple recipients
  subject,
  html,
  headers: {...}
})

console.log(`✅ Sent email to ${allEmails.length} email(s): ${allEmails.join(', ')}`)
```

---

## Example Scenarios

### Scenario 1: New Ticket from External Email

**User Profile:**
- Primary: `john.doe@surterreproperties.com`
- Alternate Emails: (none yet)

**Event:**
1. Email received from `john.doe@gmail.com` with ticket request
2. System runs `findUserByAnyEmail('john.doe@gmail.com')` → not found
3. System runs `linkExternalEmailToUser('john.doe@gmail.com')`:
   - Extracts "john.doe" from email
   - Searches for `john.doe@surterreproperties.com` → **FOUND**
   - Creates UserEmail record:
     ```javascript
     {
       userId: 'user-id',
       email: 'john.doe@gmail.com',
       emailType: 'personal',
       isVerified: true,
       addedBy: 'system'
     }
     ```
4. Ticket created with requester = John Doe's profile
5. Notifications sent to BOTH emails:
   - `john.doe@surterreproperties.com`
   - `john.doe@gmail.com`

**Result:** No duplicate user created, both emails receive notifications

---

### Scenario 2: Subsequent Ticket from Same External Email

**User Profile:**
- Primary: `john.doe@surterreproperties.com`
- Alternate Emails: `john.doe@gmail.com` (verified)

**Event:**
1. Email received from `john.doe@gmail.com` with new ticket
2. System runs `findUserByAnyEmail('john.doe@gmail.com')` → **FOUND immediately**
3. Ticket created with requester = John Doe's profile
4. Notifications sent to BOTH emails

**Result:** Instant recognition, no database writes needed

---

### Scenario 3: Comment Added to Ticket

**Ticket:**
- Requester: John Doe (has 3 emails)
- Assignee: Jane Smith (has 2 emails)

**Event:**
1. Jane Smith adds comment to ticket
2. System calls `getAllUserEmails(johnDoe.id)`:
   - Returns: `['john.doe@surterreproperties.com', 'john.doe@gmail.com', 'jdoe@yahoo.com']`
3. Email sent with `to: 'john.doe@surterreproperties.com, john.doe@gmail.com, jdoe@yahoo.com'`

**Result:** John receives notification on ALL three emails

---

## Benefits

### 1. **No Duplicate Users**
- Before: Each external email created a new user
- After: External emails automatically link to existing profiles

### 2. **Comprehensive Notifications**
- Users receive notifications on all their email addresses
- Important updates never missed due to checking only one inbox

### 3. **Microsoft Entra as Source of Truth**
- Official @surterreproperties.com email remains primary
- Profile data (name, job title, etc.) comes from Entra ID
- External emails are just additional contact points

### 4. **Automatic Linking**
- No manual intervention required
- System intelligently matches emails based on username
- Works for common patterns: `firstname.lastname@domain.com`

---

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `SMTP_*` variables for email sending
- `DATABASE_URL` for PostgreSQL connection

### Database Migration
Already applied via `npx prisma db push`:
- Created `user_emails` table
- Added indexes for performance
- Added foreign key constraints

---

## Monitoring & Logs

### Success Logs
```
✅ Linked external email john.doe@gmail.com to user john.doe@surterreproperties.com
✅ Sent ticket creation email to 2 email(s): john.doe@surterreproperties.com, john.doe@gmail.com
✅ Sent comment email to 3 email(s): john.doe@surterreproperties.com, john.doe@gmail.com, jdoe@yahoo.com
```

### Error Handling
- Falls back to primary email if alternate emails lookup fails
- Auto-verification prevents email delivery issues
- Duplicate email prevention (unique constraint on `email` column)

---

## Next Steps (Future Enhancements)

### 1. **User Interface for Email Management** (In Progress)
- View all linked emails in profile
- Add/remove alternate emails manually
- Set email preferences (which emails get notifications)

### 2. **Email Verification Flow**
- Send verification link for manually added emails
- Only send notifications to verified emails

### 3. **Email Preferences**
- Allow users to choose which emails receive which notifications
- Ticket updates, comments, assignments, etc.

### 4. **Admin Dashboard**
- View all users with multiple emails
- Manually link/unlink emails
- Merge duplicate accounts

---

## Security Considerations

### 1. **Email Uniqueness**
- Each email can only belong to ONE user
- Database unique constraint prevents conflicts
- `addAlternateEmail()` checks for existing use before adding

### 2. **Auto-Verification**
- Emails that create tickets are auto-verified (they're real)
- Manually added emails should require verification (future enhancement)

### 3. **Data Privacy**
- All email addresses stored securely in PostgreSQL
- Alternate emails visible only to user and admins
- Audit trail tracks who added each email (`addedBy` field)

---

## Testing

### Manual Testing Checklist
1. ✅ Send email from external address (Gmail)
2. ✅ Verify ticket created with correct user profile
3. ✅ Check that external email was linked to existing user
4. ✅ Send another email from same external address
5. ✅ Verify no duplicate user created
6. ✅ Add comment to ticket
7. ✅ Verify email sent to ALL user emails
8. ✅ Check logs for success messages

### Database Queries for Testing
```sql
-- View all users with multiple emails
SELECT u.email as primary_email,
       u.firstName || ' ' || u.lastName as name,
       COUNT(ue.id) as alternate_emails
FROM users u
LEFT JOIN user_emails ue ON ue.user_id = u.id
GROUP BY u.id
HAVING COUNT(ue.id) > 0;

-- View specific user's emails
SELECT u.email as primary_email,
       ue.email as alternate_email,
       ue.email_type,
       ue.is_verified,
       ue.added_at
FROM users u
LEFT JOIN user_emails ue ON ue.user_id = u.id
WHERE u.email = 'john.doe@surterreproperties.com';
```

---

## Summary

The multi-email feature successfully addresses the requirement to:
1. ✅ Link external emails to existing @surterreproperties.com users
2. ✅ Prevent duplicate user creation
3. ✅ Send notifications to ALL user emails
4. ✅ Use Microsoft Entra as source of truth for profile data
5. ✅ Automatically handle email linking without manual intervention

The system is now production-ready and will automatically handle tickets from any email address while maintaining clean user records and comprehensive notification coverage.
