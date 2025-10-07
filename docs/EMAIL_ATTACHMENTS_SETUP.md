# Email Attachments Setup Guide

## Overview

This guide explains how to configure the email-to-ticket workflow to automatically download and save attachments from emails.

## How It Works

1. **Email arrives** at helpdesk@surterreproperties.com
2. **Microsoft Graph webhook** notifies the system
3. **N8N workflow** creates the ticket
4. **N8N calls attachment endpoint** with the email's messageId
5. **AttachmentHandler** downloads attachments from Microsoft Graph
6. **Attachments saved** to `/opt/apps/aidin/uploads/attachments/{userId}/{ticketId}/`
7. **Database records** created in `attachments` table

## API Endpoint

### POST /api/tickets/{ticketId}/email-attachments

Processes attachments from a Microsoft Graph email message and saves them to a ticket.

**Request Body:**
```json
{
  "messageId": "AAMkAGI1NGNjOWQ5LWU5MTktNDUwMi1iZDYzLWZhZGRhNTllYjEwYwBGAAAAAAA...",
  "userEmail": "helpdesk@surterreproperties.com"
}
```

**Response:**
```json
{
  "success": true,
  "ticketId": "938362f4-f576-4aa5-a719-0160ddecbdb5",
  "ticketNumber": "IT000081",
  "attachmentsProcessed": 2,
  "attachments": [
    {
      "id": "a1b2c3d4-...",
      "fileName": "screenshot.png",
      "fileSize": 245678,
      "mimeType": "image/png"
    },
    {
      "id": "e5f6g7h8-...",
      "fileName": "document.pdf",
      "fileSize": 1234567,
      "mimeType": "application/pdf"
    }
  ]
}
```

## N8N Workflow Configuration

### Method 1: Add HTTP Request Node (Recommended)

Add this node **after** the ticket is created:

1. **Add HTTP Request Node**
   - Name: `Process Email Attachments`
   - Method: `POST`
   - URL: `https://helpdesk.surterreproperties.com/api/tickets/{{ $json.ticketId }}/email-attachments`

2. **Configure Headers**
   ```
   Content-Type: application/json
   ```

3. **Configure Body**
   ```json
   {
     "messageId": "{{ $json.messageId }}",
     "userEmail": "helpdesk@surterreproperties.com"
   }
   ```

4. **Error Handling**
   - Set "Continue On Fail" to `true` (attachments shouldn't block ticket creation)

5. **Conditional Execution**
   - Only run if `hasAttachments` is true
   - Expression: `{{ $json.hasAttachments === true }}`

### Method 2: Update Existing Workflow

If you have an existing "Email to Ticket" workflow:

1. **After ticket creation**, add the HTTP Request node
2. **Pass the messageId** from the email webhook notification
3. **Pass the ticketId** from the ticket creation response

### Example N8N Flow

```
[Email Webhook]
    → [Get Email Details from Graph]
    → [Parse Email Content]
    → [Create Ticket via API]
    → [IF hasAttachments]
        → [Process Email Attachments] ← NEW NODE
    → [Send Notification]
```

### Complete HTTP Request Configuration

```javascript
// URL
https://helpdesk.surterreproperties.com/api/tickets/{{ $('Create Ticket').item.json.ticket.id }}/email-attachments

// Headers
{
  "Content-Type": "application/json"
}

// Body (JSON)
{
  "messageId": "{{ $('Get Email Details').item.json.id }}",
  "userEmail": "helpdesk@surterreproperties.com"
}

// Options
{
  "continueOnFail": true,
  "timeout": 30000
}
```

## How to Get the messageId

The `messageId` comes from the Microsoft Graph notification. You need to:

1. **Extract from webhook notification resource:**
   ```javascript
   // Resource format: users/{email}/mailFolders/{folder}/messages/{messageId}
   const resource = notification.resource
   const messageId = resource.split('/').pop()
   ```

2. **Or use the resourceData.id:**
   ```javascript
   const messageId = notification.resourceData.id
   ```

## Testing

### Test with Existing Ticket

You can manually test the attachment processing for an existing email:

```bash
curl -X POST https://helpdesk.surterreproperties.com/api/tickets/{ticketId}/email-attachments \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "AAMkAGI1NGNjOWQ5LWU5MTktNDUwMi1iZDYzLWZhZGRhNTllYjEwYwBGAAAAAAA...",
    "userEmail": "helpdesk@surterreproperties.com"
  }'
```

### Retroactive Processing

To process attachments for ticket IT000081:

1. Find the email messageId in Microsoft Graph
2. Call the API endpoint with the ticketId and messageId

```bash
# Get ticket ID
sqlite3 /opt/apps/aidin/prisma/dev.db "SELECT id FROM tickets WHERE ticketNumber = 'IT000081';"

# Process attachments
curl -X POST https://helpdesk.surterreproperties.com/api/tickets/{ticketId}/email-attachments \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "{messageId from Graph}",
    "userEmail": "helpdesk@surterreproperties.com"
  }'
```

## Troubleshooting

### Issue: Attachments not appearing

**Check:**
1. Is the N8N HTTP Request node being executed?
2. Check N8N execution logs
3. Check application logs: `pm2 logs aidin-helpdesk | grep EmailAttachments`
4. Verify messageId is correct
5. Verify Microsoft Graph permissions include `Mail.Read`

### Issue: "Failed to get attachments" error

**Solution:**
- Verify Azure AD app has `Mail.Read` permission
- Check if access token is valid
- Verify the messageId exists in the mailbox

### Issue: Attachment validation failed

**Check:**
- File size (max 25MB per file)
- File type (must be in allowed MIME types)
- Total ticket size (max 50MB per ticket)

### Issue: Attachments downloaded but not visible

**Check:**
1. Database records:
```sql
SELECT * FROM attachments WHERE ticketId = '{ticketId}';
```

2. Files on disk:
```bash
ls -la /opt/apps/aidin/uploads/attachments/{userId}/{ticketId}/
```

3. Refresh the ticket page in browser

## Required Permissions

### Microsoft Graph API Permissions

Your Azure AD app needs:
- ✅ `Mail.Read` (Application permission)
- ✅ `Mail.ReadWrite` (if you want to move processed emails)

### File System Permissions

Ensure the uploads directory is writable:
```bash
chmod 755 /opt/apps/aidin/uploads/attachments/
chown -R www-data:www-data /opt/apps/aidin/uploads/attachments/
```

## Supported File Types

- **Images**: jpg, jpeg, png, gif, webp, bmp, tiff, svg
- **Documents**: pdf, doc, docx, txt, rtf, odt
- **Spreadsheets**: xls, xlsx, csv, ods
- **Presentations**: ppt, pptx
- **Archives**: zip, rar, 7z, tar, gz
- **Data**: json, xml

## Size Limits

- **Per file**: 25 MB
- **Per ticket**: 50 MB total
- **Files auto-deleted**: After 6 months

## Implementation Checklist

- [ ] Azure AD app has `Mail.Read` permission
- [ ] N8N workflow updated with HTTP Request node
- [ ] messageId is being passed from email webhook
- [ ] ticketId is available from ticket creation
- [ ] Test with a sample email with attachments
- [ ] Verify attachments appear in ticket detail page
- [ ] Check attachment cleanup scheduler is running

## Monitoring

### Check attachment processing

```bash
# View recent attachments
sqlite3 /opt/apps/aidin/prisma/dev.db "SELECT fileName, fileSize, uploadedAt FROM attachments ORDER BY uploadedAt DESC LIMIT 10;"

# Check disk usage
du -sh /opt/apps/aidin/uploads/attachments/

# View processing logs
pm2 logs aidin-helpdesk --lines 100 | grep -i "attachment"
```

## Security Notes

1. **Access Control**: Attachments use the same access control as tickets
2. **Validation**: All files are validated for type and size
3. **Sanitization**: Filenames are sanitized to prevent path traversal
4. **Expiry**: Files automatically deleted after 6 months
5. **Audit Trail**: All deletions are logged

## Future Enhancements

Potential improvements:
- [ ] Virus scanning with ClamAV
- [ ] Image thumbnails
- [ ] Automatic archive extraction
- [ ] Inline image embedding in ticket description
- [ ] Attachment preview in ticket list
