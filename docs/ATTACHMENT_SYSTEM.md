# Attachment System Documentation

## Overview

The attachment system allows users to upload files to tickets with automatic cleanup after 6 months. Files are organized by user and ticket, with comprehensive logging of all deletions.

## Features

- **File Upload**: Drag-and-drop or click-to-upload interface
- **File Types**: Supports images, PDFs, documents, spreadsheets, archives, and more
- **Size Limits**:
  - 25MB per file
  - 50MB total per ticket
- **Auto-Cleanup**: Files automatically deleted after 6 months
- **Deletion Logging**: All deletions logged with timestamp and reason
- **User Folders**: Files organized by user ID and ticket ID
- **Access Control**: Role-based access using existing ticket permissions

## Architecture

### Database Schema

**Attachment Table** (`attachments`):
- `id` - UUID primary key
- `ticketId` - Reference to ticket
- `userId` - User who uploaded the file
- `fileName` - Original file name
- `fileSize` - Size in bytes
- `mimeType` - MIME type (e.g., image/png, application/pdf)
- `filePath` - Relative path on disk
- `uploadedAt` - Upload timestamp
- `expiresAt` - Auto-calculated expiry date (uploadedAt + 6 months)

**AttachmentDeletionLog Table** (`attachment_deletion_logs`):
- `id` - UUID primary key
- `userId` - User whose folder contained the file
- `fileName` - Name of deleted file
- `fileSize` - Size of deleted file
- `filePath` - Path where file was stored
- `deletedAt` - Deletion timestamp
- `deletedBy` - 'system' for auto-cleanup, user ID for manual deletion
- `reason` - 'expired', 'manual', or 'ticket_deleted'

### File Storage Structure

```
/opt/apps/aidin/uploads/attachments/
├── {userId}/
│   ├── {ticketId}/
│   │   ├── filename_timestamp_hash.ext
│   │   └── another_file_timestamp_hash.pdf
│   └── {ticketId}/
│       └── ...
└── {userId}/
    └── ...
```

### Allowed File Types

- **Images**: jpg, jpeg, png, gif, webp, bmp, tiff, svg
- **Documents**: pdf, doc, docx, txt, rtf, odt
- **Spreadsheets**: xls, xlsx, csv, ods
- **Presentations**: ppt, pptx
- **Archives**: zip, rar, 7z, tar, gz
- **Data**: json, xml

## Components

### Backend Services

1. **AttachmentService** (`lib/services/AttachmentService.js`)
   - File validation
   - File storage and retrieval
   - Attachment CRUD operations
   - Cleanup of expired files
   - Deletion logging

2. **AttachmentCleanupScheduler** (`lib/services/AttachmentCleanupScheduler.js`)
   - Runs daily at 2:00 AM
   - Deletes files older than 6 months
   - Cleans up empty directories
   - Logs all deletions

### API Endpoints

1. **GET /api/attachments?ticketId={id}**
   - Get all attachments for a ticket
   - Requires read access to ticket

2. **POST /api/attachments**
   - Upload a file
   - Body: multipart/form-data with `file` and `ticketId`
   - Requires write access to ticket

3. **GET /api/attachments/{id}/download**
   - Download a specific attachment
   - Requires read access to ticket

4. **DELETE /api/attachments?id={id}**
   - Delete an attachment
   - Requires write access to ticket
   - Logs deletion

### Frontend Components

**AttachmentUpload** (`components/AttachmentUpload.jsx`):
- Drag-and-drop upload interface
- File list with download/delete actions
- Progress indicators
- File type icons
- Size formatting

## Usage

### In Ticket Detail Page

The attachment section is automatically included in the ticket detail page between the ticket description and comments section.

```jsx
<AttachmentUpload
  ticketId={ticket.id}
  existingAttachments={ticket.attachments}
  onUploadComplete={() => fetchTicket()}
  readOnly={!canEdit}
/>
```

### Programmatic Upload

```javascript
import { AttachmentService } from '@/lib/services/AttachmentService'

// Upload a file
const attachment = await AttachmentService.uploadAttachment(
  file,        // File object
  ticketId,    // Ticket UUID
  userId       // User UUID
)

// Get ticket attachments
const attachments = await AttachmentService.getTicketAttachments(ticketId)

// Delete attachment
await AttachmentService.deleteAttachment(
  attachmentId,
  userId,      // Who deleted it
  'manual'     // Reason
)
```

### Manual Cleanup Trigger

```javascript
import attachmentCleanupScheduler from '@/lib/services/AttachmentCleanupScheduler'

// Trigger cleanup manually
await attachmentCleanupScheduler.trigger()
```

## Security & Best Practices

### Security Features

1. **File Validation**:
   - MIME type checking
   - File extension validation
   - Size limits enforced

2. **Access Control**:
   - Uses existing ticket permission system
   - Users can only access attachments for tickets they can view

3. **Safe Filenames**:
   - Original filenames sanitized
   - Random hash added to prevent collisions
   - Timestamp included for uniqueness

4. **Directory Permissions**:
   - Upload directory: 0755
   - Files: 0644

### Performance Considerations

1. **File Streaming**: Large files are streamed, not loaded entirely into memory

2. **Database Indexes**:
   - `userId` for quick user lookups
   - `ticketId` for ticket queries
   - `expiresAt` for cleanup job efficiency

3. **Empty Directory Cleanup**: Cleanup job removes empty directories to prevent directory bloat

4. **Batch Operations**: Cleanup processes files in batches to avoid memory issues

### Storage Management

1. **Automatic Cleanup**: Files deleted after 6 months automatically

2. **Deletion Logging**: Every deletion logged with:
   - Who deleted it (user or system)
   - When it was deleted
   - Why it was deleted (expired, manual, ticket deleted)

3. **Manual Cleanup**: Admin can trigger cleanup via scheduler

4. **View Deletion Logs**:
```javascript
const logs = await AttachmentService.getUserDeletionLog(userId, limit)
```

## Monitoring

### Check Cleanup Job Status

```bash
# Check PM2 logs for cleanup job
pm2 logs aidin-helpdesk | grep "Attachment Cleanup"
```

### Check Disk Usage

```bash
# Check uploads directory size
du -sh /opt/apps/aidin/uploads/attachments/

# List largest files
find /opt/apps/aidin/uploads/attachments/ -type f -exec du -h {} + | sort -rh | head -20
```

### Query Database Statistics

```sql
-- Total attachments
SELECT COUNT(*) FROM attachments;

-- Total size
SELECT SUM(fileSize) / 1024 / 1024 as total_mb FROM attachments;

-- Attachments by MIME type
SELECT mimeType, COUNT(*), SUM(fileSize) / 1024 / 1024 as total_mb
FROM attachments
GROUP BY mimeType
ORDER BY total_mb DESC;

-- Expiring soon (next 30 days)
SELECT COUNT(*) FROM attachments
WHERE expiresAt < datetime('now', '+30 days');

-- Recent deletions
SELECT * FROM attachment_deletion_logs
ORDER BY deletedAt DESC
LIMIT 50;
```

## Troubleshooting

### Issue: Upload fails with "File type not allowed"

**Solution**: Check if the MIME type is in the `ALLOWED_MIME_TYPES` list in `AttachmentService.js`. Add it if needed.

### Issue: Files not being cleaned up

**Solution**:
1. Check if scheduler is running: `pm2 logs aidin-helpdesk`
2. Check `expiresAt` dates in database
3. Manually trigger cleanup:
```javascript
import attachmentCleanupScheduler from '@/lib/services/AttachmentCleanupScheduler'
await attachmentCleanupScheduler.trigger()
```

### Issue: Download fails with "File not found"

**Solution**:
1. Check if file exists on disk: `ls /opt/apps/aidin/uploads/attachments/{userId}/{ticketId}/`
2. Check file permissions: `ls -la /opt/apps/aidin/uploads/attachments/{userId}/{ticketId}/`
3. Check database record matches file path

### Issue: Disk space running low

**Solution**:
1. Run manual cleanup: `attachmentCleanupScheduler.trigger()`
2. Reduce expiry time (change `EXPIRY_MONTHS` in `AttachmentService.js`)
3. Reduce file size limits

## Future Enhancements

Potential improvements for the attachment system:

1. **Email Attachments**: Automatically attach files from email-to-ticket
2. **Image Previews**: Show thumbnails for image attachments
3. **Virus Scanning**: Integrate ClamAV or similar for file scanning
4. **Cloud Storage**: Option to use S3/Azure Blob instead of local disk
5. **Compression**: Auto-compress large files
6. **Archive Extraction**: View contents of zip files
7. **Version Control**: Keep versions of replaced files
8. **Shared Attachments**: Attach one file to multiple tickets

## Configuration

### Environment Variables

None required - system uses defaults from `AttachmentService.js`.

To customize, you can add:

```env
# Optional: Override attachment settings
ATTACHMENT_MAX_FILE_SIZE=26214400  # 25MB in bytes
ATTACHMENT_MAX_TICKET_SIZE=52428800  # 50MB in bytes
ATTACHMENT_EXPIRY_MONTHS=6
```

### Customization

Edit `/opt/apps/aidin/lib/services/AttachmentService.js`:

```javascript
static MAX_FILE_SIZE = 25 * 1024 * 1024  // 25MB
static MAX_TOTAL_SIZE_PER_TICKET = 50 * 1024 * 1024  // 50MB
static EXPIRY_MONTHS = 6
```

Edit `/opt/apps/aidin/lib/services/AttachmentCleanupScheduler.js`:

```javascript
// Change cleanup schedule (currently 2:00 AM daily)
this.job = cron.schedule('0 2 * * *', () => {
  // Cron syntax: minute hour day month dayofweek
  // Examples:
  // '0 2 * * *'     - 2:00 AM daily
  // '0 */6 * * *'   - Every 6 hours
  // '0 0 * * 0'     - Midnight every Sunday
})
```

## Testing

### Manual Test Upload

1. Go to any ticket detail page
2. Click "Select Files" or drag files into the upload area
3. Verify file appears in the attachments list
4. Click download icon to test download
5. Click delete icon to test deletion
6. Check database:
```sql
SELECT * FROM attachments ORDER BY uploadedAt DESC LIMIT 5;
SELECT * FROM attachment_deletion_logs ORDER BY deletedAt DESC LIMIT 5;
```

### Test Cleanup Job

```javascript
// In Node.js console or script
import attachmentCleanupScheduler from './lib/services/AttachmentCleanupScheduler.js'

// Create a test attachment with expired date
import { prisma } from './lib/prisma.js'
const testAttachment = await prisma.attachment.create({
  data: {
    ticketId: 'existing-ticket-id',
    userId: 'existing-user-id',
    fileName: 'test.txt',
    fileSize: 100,
    mimeType: 'text/plain',
    filePath: 'test/path/test.txt',
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
  }
})

// Run cleanup
await attachmentCleanupScheduler.trigger()

// Verify deletion
const deleted = await prisma.attachment.findUnique({
  where: { id: testAttachment.id }
})
console.log('Attachment deleted:', deleted === null)

const log = await prisma.attachmentDeletionLog.findFirst({
  where: { fileName: 'test.txt' },
  orderBy: { deletedAt: 'desc' }
})
console.log('Deletion logged:', log)
```
