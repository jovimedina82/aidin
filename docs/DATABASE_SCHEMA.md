# Aidin Helpdesk - Database Schema Reference

**Database:** PostgreSQL
**ORM:** Prisma 6.16.1
**Total Models:** 38
**Total Enums:** 5
**Last Updated:** November 16, 2025

---

## Schema Overview

The Aidin database schema consists of 38 models organized into 9 functional categories, supporting a comprehensive helpdesk system with AI features, email integration, audit compliance, and staff management.

---

## 1. Enums

### TicketStatus
```prisma
enum TicketStatus {
  NEW       // Ticket just created
  OPEN      // Being worked on
  PENDING   // Waiting for customer
  ON_HOLD   // Temporarily paused
  SOLVED    // Resolution provided
}
```

### TicketPriority
```prisma
enum TicketPriority {
  LOW       // Low urgency
  NORMAL    // Standard priority
  HIGH      // High priority
  URGENT    // Critical/emergency
}
```

### NotificationSeverity
```prisma
enum NotificationSeverity {
  INFO      // Informational
  WARNING   // Caution required
  ERROR     // Error occurred
  CRITICAL  // Critical alert
}
```

### AssetKind
```prisma
enum AssetKind {
  inline      // Inline image (CID)
  attachment  // File attachment
  derived     // Processed variant
}
```

### AssetVariant
```prisma
enum AssetVariant {
  original    // Original file
  web         // Web-optimized version
  thumb       // Thumbnail
}
```

---

## 2. User Management Models

### User
Primary user account model.

```prisma
model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  password            String?   // Hashed with bcrypt
  firstName           String
  lastName            String
  phone               String?
  userType            String    @default("Client")
  managerId           String?   // Self-referential
  isActive            Boolean   @default(true)
  lastLoginAt         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Azure AD fields
  azureId             String?   @unique
  userPrincipalName   String?   @unique
  jobTitle            String?
  officeLocation      String?
  mobilePhone         String?
  avatar              String?   // Base64 data URL
  lastSyncAt          DateTime?

  // Relations
  manager             User?     @relation("UserManager", fields: [managerId], references: [id])
  directReports       User[]    @relation("UserManager")
  assignedTickets     Ticket[]  @relation("TicketAssignee")
  createdTickets      Ticket[]  @relation("TicketRequester")
  comments            TicketComment[]
  roles               UserRole[]
  departments         UserDepartment[]
  alternateEmails     UserEmail[]
  preferences         UserPreference?
  attachments         Attachment[] @relation("AttachmentUploader")
  moduleAccess        UserModuleAccess[]
  staffPresence       StaffPresence[]
  classifierFeedback  ClassifierFeedback[]
  createdKBArticles   KnowledgeBase[] @relation("KBCreator")

  @@map("users")
}
```

**Key Features:**
- Self-referential hierarchy (manager/reports)
- Azure AD integration fields
- Multiple email addresses support
- Role and department assignments
- Soft delete via isActive flag

---

### UserEmail
Alternative email addresses for users.

```prisma
model UserEmail {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  email       String    @unique
  emailType   String    @default("alternate")
  isPrimary   Boolean   @default(false)
  isVerified  Boolean   @default(false)
  addedAt     DateTime  @default(now()) @map("added_at")
  addedBy     String?   @map("added_by")
  verifiedAt  DateTime? @map("verified_at")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([email])
  @@map("user_emails")
}
```

---

### Role
Role definitions with JSON permissions.

```prisma
model Role {
  id            String    @id @default(uuid())
  name          String    @unique
  description   String?
  permissions   Json      // Flexible permission structure
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  users         UserRole[]
  moduleAccess  RoleModuleAccess[]

  @@map("roles")
}
```

**Common Roles:**
- Admin - Full system access
- Manager - Team management
- Staff - Ticket handling
- Client - View own tickets

---

### UserRole
User-to-role assignments (many-to-many).

```prisma
model UserRole {
  id      String @id @default(uuid())
  userId  String
  roleId  String

  role    Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}
```

---

### UserPreference
User-specific settings.

```prisma
model UserPreference {
  id                   String    @id @default(uuid())
  userId               String    @unique
  personalViewOrder    String?   // JSON: ticket list column order
  companyViewOrder     String?   // JSON: company view preferences
  dashboardCardOrder   String?   // JSON: dashboard widget order
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_preferences")
}
```

---

### Module
Feature module definitions.

```prisma
model Module {
  id           String    @id @default(uuid())
  name         String    @unique  // "Tickets", "Reports"
  key          String    @unique  // "tickets", "reports"
  description  String?
  icon         String?             // Lucide icon name
  route        String?             // Primary route path
  category     String?             // "core", "admin", "features"
  isCore       Boolean   @default(false)  // Can't be disabled
  isActive     Boolean   @default(true)
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  userModuleAccess UserModuleAccess[]
  roleModuleAccess RoleModuleAccess[]

  @@index([key])
  @@index([isActive])
  @@map("modules")
}
```

---

### UserModuleAccess
Per-user module permissions (overrides role).

```prisma
model UserModuleAccess {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  moduleId   String    @map("module_id")
  hasAccess  Boolean   @default(true)
  grantedBy  String?   @map("granted_by")  // Admin who granted
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  module     Module    @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([userId, moduleId])
  @@index([userId])
  @@index([moduleId])
  @@map("user_module_access")
}
```

---

### RoleModuleAccess
Per-role default module permissions.

```prisma
model RoleModuleAccess {
  id         String    @id @default(uuid())
  roleId     String    @map("role_id")
  moduleId   String    @map("module_id")
  hasAccess  Boolean   @default(true)
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  role       Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  module     Module    @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([roleId, moduleId])
  @@index([roleId])
  @@index([moduleId])
  @@map("role_module_access")
}
```

---

## 3. Ticket System Models

### Ticket
Core ticket entity with full lifecycle support.

```prisma
model Ticket {
  id                    String          @id @default(uuid())
  ticketNumber          String          @unique  // "TICK-2025-001"
  title                 String
  description           String
  status                TicketStatus    @default(NEW)
  priority              TicketPriority  @default(NORMAL)
  category              String?
  requesterId           String?
  assigneeId            String?
  departmentId          String?
  emailConversationId   String?         // Email thread ID
  parentTicketId        String?         // For ticket threading

  // AI draft response
  aiDraftResponse       String?
  aiDraftGeneratedAt    DateTime?
  aiDraftGeneratedBy    String?         // AI model used

  // Customer satisfaction
  satisfactionRating    Int?            // 1-5
  satisfactionFeedback  String?

  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  resolvedAt            DateTime?
  closedAt              DateTime?

  // Relations
  requester             User?           @relation("TicketRequester", fields: [requesterId], references: [id])
  assignee              User?           @relation("TicketAssignee", fields: [assigneeId], references: [id])
  parentTicket          Ticket?         @relation("TicketThread", fields: [parentTicketId], references: [id])
  childTickets          Ticket[]        @relation("TicketThread")
  comments              TicketComment[]
  attachments           Attachment[]
  tags                  TicketTag[]
  cc                    TicketCC[]
  ticketMessages        TicketMessage[]
  inboundMessages       InboundMessage[]
  messageAssets         MessageAsset[]  @relation("TicketAssets")
  aiDecision            AIDecision?
  kbUsage               TicketKBUsage[]

  // Performance indexes
  @@index([status])
  @@index([assigneeId])
  @@index([requesterId])
  @@index([departmentId])
  @@index([createdAt])
  @@index([updatedAt])
  @@index([resolvedAt])
  @@index([parentTicketId])
  @@index([emailConversationId])
  @@index([status, assigneeId])
  @@index([status, requesterId])
  @@index([status, departmentId])
  @@index([status, updatedAt])
  @@index([priority, createdAt])
  @@map("tickets")
}
```

**Key Features:**
- Hierarchical threading (parent/child)
- AI draft response storage
- Customer satisfaction tracking
- Email conversation linking
- Comprehensive indexing for queries

---

### TicketComment
User comments on tickets.

```prisma
model TicketComment {
  id          String    @id @default(uuid())
  ticketId    String
  userId      String
  content     String
  isPublic    Boolean   @default(true)  // Internal vs public
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id])
  attachments Attachment[]

  @@index([ticketId, createdAt])
  @@index([userId])
  @@map("ticket_comments")
}
```

---

### TicketMessage
Email messages associated with tickets.

```prisma
model TicketMessage {
  id           String    @id @default(uuid())
  ticketId     String    @map("ticket_id")
  kind         String    // "email", "note", "system"
  authorId     String?   @map("author_id")
  authorEmail  String?   @map("author_email")
  authorName   String?   @map("author_name")
  html         String?   // Rich content
  text         String?   // Plain text
  subject      String?
  metadata     String?   // JSON: additional data
  isPublic     Boolean   @default(true) @map("is_public")
  createdAt    DateTime  @default(now()) @map("created_at")
  editedAt     DateTime? @map("edited_at")

  ticket       Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([authorEmail])
  @@map("ticket_messages")
}
```

---

### Tag
Reusable tags for ticket categorization.

```prisma
model Tag {
  id          String    @id @default(uuid())
  name        String    @unique  // Normalized name
  displayName String    @map("display_name")  // Display name
  color       String?   // Hex color code
  category    String?   // Tag category
  isActive    Boolean   @default(true) @map("is_active")
  usageCount  Int       @default(0) @map("usage_count")
  createdAt   DateTime  @default(now()) @map("created_at")

  tickets     TicketTag[]

  @@index([name])
  @@index([category])
  @@map("tags")
}
```

---

### TicketTag
Many-to-many relationship between tickets and tags.

```prisma
model TicketTag {
  id        String    @id @default(uuid())
  ticketId  String    @map("ticket_id")
  tagId     String    @map("tag_id")
  addedAt   DateTime  @default(now()) @map("added_at")
  addedBy   String?   @map("added_by")  // User ID or "system"

  ticket    Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  tag       Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([ticketId, tagId])
  @@index([ticketId])
  @@index([tagId])
  @@map("ticket_tags")
}
```

---

### TicketCC
CC recipients for email notifications.

```prisma
model TicketCC {
  id        String    @id @default(uuid())
  ticketId  String    @map("ticket_id")
  email     String
  name      String?   // Display name
  addedAt   DateTime  @default(now()) @map("added_at")
  addedBy   String?   @map("added_by")  // User ID or "system"
  source    String    @default("manual")  // "manual" or "original"

  ticket    Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@unique([ticketId, email])
  @@index([ticketId])
  @@index([email])
  @@map("ticket_cc")
}
```

---

### WeeklyTicketStats
Pre-aggregated weekly statistics.

```prisma
model WeeklyTicketStats {
  id                String    @id @default(uuid())
  weekStartDate     DateTime
  weekEndDate       DateTime
  year              Int
  weekNumber        Int
  totalTickets      Int       @default(0)
  newTickets        Int       @default(0)
  openTickets       Int       @default(0)
  pendingTickets    Int       @default(0)
  onHoldTickets     Int       @default(0)
  solvedTickets     Int       @default(0)
  closedTickets     Int       @default(0)
  unassignedTickets Int       @default(0)
  effectiveness     Float     @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([year, weekNumber])
  @@map("weekly_ticket_stats")
}
```

---

## 4. Knowledge Management Models

### Department
Department/team definitions.

```prisma
model Department {
  id            String    @id @default(uuid())
  name          String    @unique
  description   String?
  color         String    @default("gray")
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  keywords      DepartmentKeyword[]
  knowledgeBase KnowledgeBase[]
  users         UserDepartment[]

  @@map("departments")
}
```

---

### DepartmentKeyword
Keywords for AI-based department routing.

```prisma
model DepartmentKeyword {
  id            String    @id @default(uuid())
  departmentId  String
  keyword       String
  weight        Float     @default(1.0)  // Importance weight
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  department    Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([departmentId, keyword])
  @@map("department_keywords")
}
```

---

### KnowledgeBase
Knowledge base articles with semantic search.

```prisma
model KnowledgeBase {
  id            String    @id @default(uuid())
  title         String
  content       String    // Rich text content
  tags          String?   // Comma-separated tags
  departmentId  String?
  createdById   String?
  isActive      Boolean   @default(true)
  embedding     String?   // Vector embedding for semantic search
  images        String?   // JSON: associated images
  usageCount    Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  createdBy        User?           @relation("KBCreator", fields: [createdById], references: [id])
  department       Department?     @relation(fields: [departmentId], references: [id])
  ticketResponses  TicketKBUsage[]

  @@map("knowledge_base")
}
```

---

### TicketKBUsage
Tracks KB article usage in ticket responses.

```prisma
model TicketKBUsage {
  id             String    @id @default(uuid())
  ticketId       String
  kbId           String
  relevance      Float     @default(0.0)  // Relevance score
  usedInResponse Boolean   @default(false)
  createdAt      DateTime  @default(now())

  knowledgeBase  KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  ticket         Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@unique([ticketId, kbId])
  @@map("ticket_kb_usage")
}
```

---

### DepartmentSequence
Ticket numbering sequences per department.

```prisma
model DepartmentSequence {
  id             String    @id @default(uuid())
  departmentCode String    @unique @map("department_code")
  departmentName String    @map("department_name")
  nextNumber     Int       @default(1) @map("next_number")
  lastReservedAt DateTime  @default(now()) @map("last_reserved_at")

  @@map("department_sequences")
}
```

---

## 5. Email System Models

### EmailIngest
Raw email storage for processing.

```prisma
model EmailIngest {
  id               String    @id @default(uuid())
  messageId        String    @unique @map("message_id")
  inReplyTo        String?   @map("in_reply_to")
  references       String?   // JSON array of message IDs
  conversationId   String?   @map("conversation_id")
  threadId         String?   @map("thread_id")
  from             String
  to               String
  cc               String?   // JSON array
  bcc              String?
  subject          String
  html             String?   // HTML content
  text             String?   // Plain text
  snippet          String?   // Preview text
  rawHeaders       String?   @map("raw_headers")  // JSON
  parsedJson       String?   @map("parsed_json")
  dedupeHash       String    @map("dedupe_hash")  // SHA256
  receivedAt       DateTime  @default(now()) @map("received_at")
  processedAt      DateTime? @map("processed_at")
  processingError  String?   @map("processing_error")
  ticketId         String?   @map("ticket_id")

  attachments      EmailAttachment[]

  @@index([messageId])
  @@index([inReplyTo])
  @@index([conversationId])
  @@index([dedupeHash])
  @@index([receivedAt(sort: Desc)])
  @@index([from, receivedAt(sort: Desc)])
  @@map("email_ingest")
}
```

---

### EmailAttachment
Attachments from ingested emails.

```prisma
model EmailAttachment {
  id             String    @id @default(uuid())
  emailIngestId  String    @map("email_ingest_id")
  filename       String
  contentType    String    @map("content_type")
  size           Int       // Bytes
  storageKey     String?   @map("storage_key")  // S3 key
  storageUrl     String?   @map("storage_url")  // CDN URL
  isInline       Boolean   @default(false) @map("is_inline")
  cid            String?   // Content-ID for inline images
  uploadedAt     DateTime  @default(now()) @map("uploaded_at")
  virusScanStatus String?  @map("virus_scan_status")
  virusScanAt    DateTime? @map("virus_scan_at")

  emailIngest    EmailIngest @relation(fields: [emailIngestId], references: [id], onDelete: Cascade)

  @@index([emailIngestId])
  @@index([cid])
  @@index([storageKey])
  @@map("email_attachments")
}
```

---

### EmailDLQ
Dead letter queue for failed email processing.

```prisma
model EmailDLQ {
  id             String    @id @default(uuid())
  failedAt       DateTime  @default(now()) @map("failed_at")
  error          String
  stackTrace     String?   @map("stack_trace")
  retryCount     Int       @default(0) @map("retry_count")
  lastRetryAt    DateTime? @map("last_retry_at")
  messageId      String?   @map("message_id")
  from           String?
  subject        String?
  rawPayload     String    @map("raw_payload")  // Original email JSON
  resolved       Boolean   @default(false)
  resolvedAt     DateTime? @map("resolved_at")
  resolvedBy     String?   @map("resolved_by")
  resolutionNote String?   @map("resolution_note")

  @@index([failedAt(sort: Desc)])
  @@index([resolved, failedAt(sort: Desc)])
  @@index([messageId])
  @@map("email_dlq")
}
```

---

## 6. AI/ML Models

### AIDecision
AI routing decisions for tickets.

```prisma
model AIDecision {
  id                    String    @id @default(uuid())
  ticketId              String    @unique
  suggestedDepartment   String?
  departmentConfidence  Float?    @default(0.0)
  keywordMatches        String?   // JSON: matched keywords
  aiReasoning           String?   // AI explanation
  finalDepartment       String?   // Actual assignment
  wasOverridden         Boolean   @default(false)
  createdAt             DateTime  @default(now())

  ticket                Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@map("ai_decisions")
}
```

---

### ClassifierFeedback
User feedback for AI training.

```prisma
model ClassifierFeedback {
  id               String    @id @default(uuid())
  ticketId         String
  emailFrom        String?
  emailSubject     String?
  emailBody        String?
  originalCategory String?
  feedbackType     String    // "correct", "wrong_category", "wrong_priority"
  correctCategory  String?
  reason           String?
  userId           String
  createdAt        DateTime  @default(now())

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([feedbackType])
  @@index([createdAt])
  @@map("classifier_feedback")
}
```

---

## 7. Presence/Scheduling Models

### PresenceStatusType
Available status types (lookup table).

```prisma
model PresenceStatusType {
  id             String    @id @default(uuid())
  code           String    @unique  // "AVAILABLE", "VACATION"
  label          String             // Display name
  category       String    @default("presence")
  requiresOffice Boolean   @default(false)
  color          String?            // Hex color
  icon           String?            // Icon name
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  staffPresence  StaffPresence[]

  @@index([isActive])
  @@index([code])
  @@map("presence_status_types")
}
```

---

### PresenceOfficeLocation
Office locations (lookup table).

```prisma
model PresenceOfficeLocation {
  id            String    @id @default(uuid())
  code          String    @unique  // "NEWPORT_BEACH"
  name          String             // Display name
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  staffPresence StaffPresence[]

  @@index([isActive])
  @@index([code])
  @@map("presence_office_locations")
}
```

---

### StaffPresence
Staff schedule segments (multi-segment per day).

```prisma
model StaffPresence {
  id                String    @id @default(uuid())
  userId            String    @map("user_id")
  statusId          String    @map("status_id")
  officeLocationId  String?   @map("office_location_id")
  notes             String?   // Max 500 chars
  startAt           DateTime  @map("start_at")  // UTC
  endAt             DateTime  @map("end_at")    // UTC
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  status            PresenceStatusType     @relation(fields: [statusId], references: [id], onDelete: Restrict)
  officeLocation    PresenceOfficeLocation? @relation(fields: [officeLocationId], references: [id], onDelete: Restrict)

  @@unique([userId, startAt, endAt, statusId, officeLocationId])
  @@index([userId, startAt])
  @@index([statusId])
  @@index([officeLocationId])
  @@map("staff_presence")
}
```

**Validation:** Total hours per user per day <= 8 (enforced in application)

---

## 8. Collaboration Models

### AidinChatSession
AI assistant chat sessions.

```prisma
model AidinChatSession {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  title      String    @default("New Chat")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  expiresAt  DateTime  @map("expires_at")  // 30-day auto-delete

  messages   AidinChatMessage[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([expiresAt])
  @@map("aidin_chat_sessions")
}
```

---

### AidinChatMessage
Messages in chat sessions.

```prisma
model AidinChatMessage {
  id         String    @id @default(uuid())
  sessionId  String    @map("session_id")
  role       String    // "user" or "assistant"
  content    String
  createdAt  DateTime  @default(now()) @map("created_at")

  session    AidinChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@map("aidin_chat_messages")
}
```

---

### Notification
In-app notification system.

```prisma
model Notification {
  id         String               @id @default(uuid())
  userId     String               @map("user_id")
  type       String               // "system", "ticket", "alert"
  title      String
  message    String
  severity   NotificationSeverity @default(INFO)
  isRead     Boolean              @default(false) @map("is_read")
  readAt     DateTime?            @map("read_at")
  actionUrl  String?              @map("action_url")  // Deep link
  metadata   Json?                // Additional context
  createdAt  DateTime             @default(now()) @map("created_at")
  expiresAt  DateTime?            @map("expires_at")

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([expiresAt])
  @@map("notifications")
}
```

---

## 9. Audit & Compliance Models

### AuditLog
Tamper-evident audit trail.

```prisma
model AuditLog {
  id              String    @id @default(uuid())
  ts              DateTime  @default(now())  // Timestamp
  action          String    // Event type
  actorId         String?   @map("actor_id")
  actorEmail      String    @map("actor_email")
  actorType       String    @map("actor_type")  // "human", "system"
  impersonatedUser String?  @map("impersonated_user")
  entityType      String    @map("entity_type")  // "ticket", "user"
  entityId        String    @map("entity_id")
  targetId        String?   @map("target_id")
  requestId       String?   @map("request_id")  // Request correlation
  correlationId   String?   @map("correlation_id")
  ip              String?
  userAgent       String?   @map("user_agent")
  prevValues      String?   @map("prev_values")  // JSON: before
  newValues       String?   @map("new_values")   // JSON: after
  metadata        String?   // JSON: additional data
  redactionLevel  Int       @default(0) @map("redaction_level")
  prevHash        String?   @map("prev_hash")  // Previous entry hash
  hash            String    // SHA256 hash for integrity

  @@unique([action, entityId, requestId])
  @@index([ts(sort: Desc)])
  @@index([entityType, entityId, ts(sort: Desc)])
  @@index([action, ts(sort: Desc)])
  @@index([actorEmail, ts(sort: Desc)])
  @@index([requestId])
  @@index([correlationId])
  @@map("audit_log")
}
```

**Key Features:**
- Hash chain for tamper detection
- PII redaction levels (0-3)
- Request/correlation ID tracing
- Before/after value tracking

---

### AuditLogDLQ
Dead letter queue for failed audit entries.

```prisma
model AuditLogDLQ {
  id           String    @id @default(uuid())
  failedAt     DateTime  @default(now()) @map("failed_at")
  error        String
  retryCount   Int       @default(0) @map("retry_count")
  lastRetryAt  DateTime? @map("last_retry_at")
  eventData    String    @map("event_data")  // JSON
  resolved     Boolean   @default(false)
  resolvedAt   DateTime? @map("resolved_at")

  @@index([failedAt(sort: Desc)])
  @@index([resolved, failedAt(sort: Desc)])
  @@map("audit_log_dlq")
}
```

---

### AuditChainVerification
Audit chain integrity verification records.

```prisma
model AuditChainVerification {
  id              String    @id @default(uuid())
  verifiedAt      DateTime  @default(now()) @map("verified_at")
  rangeStart      DateTime  @map("range_start")
  rangeEnd        DateTime  @map("range_end")
  totalEntries    Int       @map("total_entries")
  verifiedEntries Int       @map("verified_entries")
  firstFailureId  String?   @map("first_failure_id")
  firstFailureTs  DateTime? @map("first_failure_ts")
  status          String    // "passed", "failed"
  details         String?   // JSON: verification details

  @@index([verifiedAt(sort: Desc)])
  @@index([status, verifiedAt(sort: Desc)])
  @@map("audit_chain_verification")
}
```

---

## 10. Security Models

### RateLimitEntry
Rate limit tracking (sliding window).

```prisma
model RateLimitEntry {
  id          String    @id @default(uuid())
  identifier  String    // IP or user ID
  endpoint    String    // API path
  requestAt   DateTime  @default(now()) @map("request_at")
  expiresAt   DateTime  @map("expires_at")

  @@index([identifier, endpoint, requestAt(sort: Desc)])
  @@index([expiresAt])
  @@map("rate_limit_entries")
}
```

---

### BlockedEmailDomain
Blocked email domains for spam prevention.

```prisma
model BlockedEmailDomain {
  id         String    @id @default(uuid())
  domain     String    @unique
  reason     String?
  blockedBy  String    // Admin who blocked
  blockedAt  DateTime  @default(now())
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([domain])
  @@map("blocked_email_domains")
}
```

---

### Attachment
File attachments with expiration.

```prisma
model Attachment {
  id          String    @id @default(uuid())
  ticketId    String
  commentId   String?   @map("comment_id")
  userId      String
  fileName    String
  fileSize    Int       // Bytes
  mimeType    String
  filePath    String    // S3/CDN URL
  uploadedAt  DateTime  @default(now())
  expiresAt   DateTime  // Auto-cleanup date
  sentInEmail Boolean   @default(false)  // From email (don't resend)

  ticket      Ticket         @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  comment     TicketComment? @relation(fields: [commentId], references: [id], onDelete: SetNull)
  user        User           @relation("AttachmentUploader", fields: [userId], references: [id])

  @@index([userId])
  @@index([ticketId])
  @@index([commentId])
  @@index([expiresAt])
  @@map("attachments")
}
```

---

### AttachmentDeletionLog
Audit trail for attachment deletions.

```prisma
model AttachmentDeletionLog {
  id         String    @id @default(uuid())
  userId     String    // Original uploader
  fileName   String
  fileSize   Int
  filePath   String
  deletedAt  DateTime  @default(now())
  deletedBy  String?   // Admin or "system"
  reason     String    // "expired", "manual", "policy"

  @@index([userId])
  @@index([deletedAt])
  @@map("attachment_deletion_logs")
}
```

---

## Database Commands

### Prisma CLI Commands

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes (development)
npx prisma db push

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset --force

# Open Prisma Studio
npx prisma studio --port 5555

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

### Yarn Shortcuts

```bash
yarn db:generate    # npx prisma generate
yarn db:push        # npx prisma db push
yarn db:seed        # node prisma/seed.js
yarn db:studio      # npx prisma studio --port 5555
yarn db:reset       # Reset + seed
```

---

## Performance Considerations

### Indexed Queries

Most efficient queries use indexed fields:

```sql
-- Fast: Uses composite index
SELECT * FROM tickets
WHERE status = 'OPEN' AND assignee_id = 'uuid'
ORDER BY updated_at DESC;

-- Fast: Uses composite index
SELECT * FROM audit_log
WHERE entity_type = 'ticket' AND entity_id = 'uuid'
ORDER BY ts DESC;
```

### Avoid Full Table Scans

```sql
-- Slow: No index on description
SELECT * FROM tickets WHERE description LIKE '%keyword%';

-- Use: Full-text search or application-level search
```

### Pagination

Always use `limit` and `offset`:

```javascript
const tickets = await prisma.ticket.findMany({
  where: { status: 'OPEN' },
  skip: offset,
  take: limit,
  orderBy: { createdAt: 'desc' }
});
```

---

## Data Integrity

### Cascade Deletes
- UserEmail, UserRole, UserDepartment → User
- TicketComment, TicketTag, TicketCC → Ticket
- EmailAttachment → EmailIngest
- AidinChatMessage → AidinChatSession

### Restrict Deletes
- StaffPresence → PresenceStatusType (prevent orphaned references)
- StaffPresence → PresenceOfficeLocation

### Soft Deletes
- User.isActive = false
- Department.isActive = false
- Tag.isActive = false
- Module.isActive = false

---

**Schema documentation generated:** November 16, 2025
**Total models:** 38
**Total fields:** 500+
**Total indexes:** 89+
