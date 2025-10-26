# AIDIN Helpdesk System - Complete X-Ray Documentation

**Version:** 0.1.0
**Last Updated:** October 25, 2025
**Production URL:** https://helpdesk.surterreproperties.com
**Repository:** /Users/owner/aidin

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Architecture](#database-architecture)
5. [API Endpoints](#api-endpoints)
6. [Core Modules & Features](#core-modules--features)
7. [File Breakdown](#file-breakdown)
8. [Infrastructure & Deployment](#infrastructure--deployment)
9. [Security & Authentication](#security--authentication)
10. [AI & Automation](#ai--automation)

---

## 1. System Overview

**AIDIN** (AI-powered Intelligent Data & Information Network) is an enterprise helpdesk system built for Surterre Properties Inc. It provides:

- **Ticket Management**: Full-featured support ticket system with email integration
- **AI-Powered Automation**: Automatic ticket categorization, routing, and response generation
- **Knowledge Base**: Searchable repository of solutions with AI-powered search
- **Staff Management**: User hierarchy, department management, and role-based access control
- **Email Integration**: Two-way email sync with Microsoft 365/Azure AD
- **Real-time Updates**: WebSocket-based live updates for collaborative work
- **Analytics & Reporting**: Comprehensive ticket analytics and satisfaction tracking
- **Audit Logging**: Tamper-proof audit trail with cryptographic verification

### Key Statistics

- **Total Files**: 437 files
- **App Routes**: 125 JavaScript/TypeScript files
- **Components**: 62 React components
- **Library Files**: 81 utility/service files
- **API Endpoints**: 102 REST API routes
- **Database Models**: 40+ Prisma models

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.3 | React framework with App Router |
| **React** | 18.x | UI library |
| **TypeScript** | 5.9.2 | Type safety (mixed with JavaScript) |
| **Tailwind CSS** | 3.4.1 | Utility-first CSS framework |
| **Radix UI** | Latest | Accessible component primitives |
| **Lucide React** | 0.516.0 | Icon library |
| **TanStack Query** | 5.90.2 | Server state management |
| **Recharts** | 3.2.1 | Data visualization |
| **Socket.IO Client** | 4.8.1 | Real-time updates |
| **Tiptap** | 3.7.2 | Rich text editor |
| **Framer Motion** | 12.23.22 | Animations |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.19.5 | Runtime environment |
| **Next.js API Routes** | 14.2.3 | Serverless API endpoints |
| **Prisma** | 6.16.1 | ORM and database toolkit |
| **PostgreSQL** | Latest | Production database (DigitalOcean) |
| **Socket.IO** | 4.8.1 | WebSocket server |
| **OpenAI API** | 5.21.0 | AI-powered features |
| **Azure MSAL** | 3.7.3 | Microsoft authentication |

### Infrastructure

| Component | Technology | Details |
|-----------|------------|---------|
| **Server** | Custom Node.js | `server.js` with Next.js |
| **Web Server** | Nginx 1.24.0 | Reverse proxy, SSL/TLS |
| **Process Manager** | SystemD | Service management |
| **SSL/TLS** | Let's Encrypt | Automatic certificate renewal |
| **Database** | PostgreSQL on DigitalOcean | Managed database |
| **File Storage** | DigitalOcean Spaces | S3-compatible object storage |
| **Email** | Microsoft Graph API | Microsoft 365 integration |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **TypeScript** | Type checking |
| **Prettier** (implied) | Code formatting |
| **tsx** | TypeScript execution |
| **Prisma Studio** | Database GUI |

---

## 3. Project Structure

```
/Users/owner/aidin/
├── app/                          # Next.js App Router pages
│   ├── admin/                    # Admin panel pages
│   │   ├── ai/                   # AI administration
│   │   ├── audit/                # Audit log viewer
│   │   └── blocked-domains/      # Email domain blocking
│   ├── api/                      # API routes (102 endpoints)
│   │   ├── admin/                # Admin APIs
│   │   ├── auth/                 # Authentication
│   │   ├── tickets/              # Ticket management
│   │   ├── users/                # User management
│   │   ├── assistant/            # AI assistant
│   │   └── [many more]/
│   ├── aidin-chat/               # AI assistant chat interface
│   ├── dashboard/                # Main dashboard
│   ├── knowledge-base/           # KB management
│   ├── login/                    # Login page
│   ├── reports/                  # Analytics & reports
│   ├── staff-directory/          # Staff availability tracker
│   ├── tickets/                  # Ticket views
│   ├── users/                    # User management
│   ├── layout.js                 # Root layout
│   └── globals.css               # Global styles
│
├── components/                   # React components (62 files)
│   ├── ui/                       # Reusable UI components (Radix)
│   ├── AuthProvider.jsx          # Authentication context
│   ├── Navbar.jsx                # Navigation
│   ├── VirtualAssistant.jsx      # AI chat widget
│   ├── RichTextEditor.jsx        # Tiptap editor
│   ├── EmailMessageViewer.tsx    # Email rendering
│   └── [many more]/
│
├── lib/                          # Core libraries & utilities
│   ├── ai/                       # AI services
│   │   ├── categorization.js     # Ticket categorization
│   │   ├── knowledge-search.js   # KB search
│   │   ├── response-generation.js# AI responses
│   │   └── routing.js            # Auto-routing
│   ├── audit/                    # Audit logging (TypeScript)
│   │   ├── logger.ts             # Main audit logger
│   │   ├── middleware.ts         # Audit middleware
│   │   ├── verifier.ts           # Chain verification
│   │   └── types.ts              # Type definitions
│   ├── email/                    # Email processing
│   ├── email-images/             # Inline image handling
│   ├── generated/prisma/         # Generated Prisma client
│   ├── hooks/                    # React hooks
│   ├── http/                     # HTTP utilities
│   ├── security/                 # Security utilities
│   ├── services/                 # Business logic services
│   │   ├── AttachmentService.js
│   │   ├── AzureSyncScheduler.js
│   │   ├── EmailService.js
│   │   └── [more]/
│   ├── auth.js                   # Auth utilities
│   ├── prisma.js                 # Prisma client singleton
│   └── socket.js                 # Socket.IO setup
│
├── modules/                      # Feature modules
│   ├── auth/                     # Auth module (TypeScript)
│   ├── classify/                 # Email classification
│   ├── email-polling/            # Email polling service
│   ├── storage/                  # File storage (Spaces)
│   └── tickets/                  # Ticket utilities
│
├── prisma/                       # Database schema & migrations
│   ├── migrations/               # Database migrations
│   ├── schema.prisma             # Database schema definition
│   ├── seed.js                   # Database seeding
│   └── seed-modules.js           # Module seeding
│
├── public/                       # Static assets
│   ├── avatars/                  # User avatars (70+ images)
│   ├── images/                   # App images
│   └── uploads/                  # User uploads
│
├── scripts/                      # Utility scripts (30+ files)
│   ├── deploy-to-production.sh   # Deployment script
│   ├── sync-azure-user.ts        # Azure AD sync
│   ├── setup-email-webhook.js    # Email webhook setup
│   └── [many more]/
│
├── docs/                         # Documentation (30+ MD files)
│   ├── ARCHITECTURE.md
│   ├── AUDIT_LOG_ARCHITECTURE.md
│   ├── EMAIL_TO_TICKET_COMPLETE.md
│   └── [many more]/
│
├── server.js                     # Custom Node.js server
├── middleware.ts                 # Next.js middleware
├── instrumentation.js            # Server initialization
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind configuration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

---

## 4. Database Architecture

### Database: PostgreSQL (Production)

**Connection**: DigitalOcean Managed PostgreSQL
**Provider**: Prisma ORM
**Schema Location**: `prisma/schema.prisma`

### Core Models (40+ total)

#### User Management

**User** (`users`)
- Primary user entity
- Fields: id, email, firstName, lastName, phone, userType, managerId, azureId, avatar
- Relations: tickets, comments, departments, roles, moduleAccess, directReports
- Authentication: Azure AD sync + local auth
- Hierarchy: Self-referencing manager relationship

**UserEmail** (`user_emails`)
- Alternate email addresses for users
- Email verification tracking
- Primary/alternate designation

**Role** (`roles`)
- Role-based access control
- JSON permissions structure
- Module access integration

**UserRole** (`user_roles`)
- Many-to-many: Users ↔ Roles

**Module** (`modules`)
- System feature/module definitions
- Granular feature access control
- Examples: Reports, Tickets, Admin

**UserModuleAccess** (`user_module_access`)
- Per-user module permissions
- Overrides role-based access

**RoleModuleAccess** (`role_module_access`)
- Default module access per role

#### Ticket System

**Ticket** (`tickets`)
- Core ticket entity
- Fields: ticketNumber (unique), title, description, status, priority, category
- Relations: requester, assignee, comments, attachments, tags, cc recipients
- Special fields: aiDraftResponse, satisfactionRating, emailConversationId, parentTicketId
- Enums: TicketStatus (NEW, OPEN, PENDING, ON_HOLD, SOLVED), TicketPriority (LOW, NORMAL, HIGH, URGENT)

**TicketComment** (`ticket_comments`)
- Comments on tickets
- Public/private designation
- Attachment support

**TicketMessage** (`ticket_messages`)
- Email messages associated with tickets
- HTML and plain text variants
- Author tracking (ID or email)

**TicketCC** (`ticket_cc`)
- CC recipients for ticket emails
- Source tracking: manual or original email
- Unique per ticket-email combination

**TicketTag** (`ticket_tags`)
- Many-to-many: Tickets ↔ Tags
- Usage tracking

**Tag** (`tags`)
- Ticket categorization tags
- Color coding and categories
- Usage count tracking

**Attachment** (`attachments`)
- File attachments for tickets/comments
- Auto-expiration (configured)
- Email send tracking

**AttachmentDeletionLog** (`attachment_deletion_logs`)
- Audit trail for deleted attachments

#### Knowledge Base

**KnowledgeBase** (`knowledge_base`)
- KB articles with rich content
- Department categorization
- Vector embeddings for AI search
- Usage tracking
- Image support

**TicketKBUsage** (`ticket_kb_usage`)
- Tracks which KB articles were used for which tickets
- Relevance scoring

#### Department & Classification

**Department** (`departments`)
- Organizational departments
- Color coding for UI
- Keyword-based auto-routing

**DepartmentKeyword** (`department_keywords`)
- Keywords for automatic ticket classification
- Weighted scoring system

**UserDepartment** (`user_departments`)
- Many-to-many: Users ↔ Departments

**DepartmentSequence** (`department_sequences`)
- Auto-incrementing ticket numbers per department
- Format: {CODE}{NUMBER} (e.g., IT000123)

**AIDecision** (`ai_decisions`)
- AI categorization decisions
- Confidence scores
- Override tracking

**ClassifierFeedback** (`classifier_feedback`)
- User corrections to AI classifications
- Continuous learning data

#### Email Integration

**EmailIngest** (`email_ingest`)
- Incoming emails from Microsoft 365
- Thread tracking: messageId, inReplyTo, conversationId
- Deduplication via hash
- Processing status

**EmailAttachment** (`email_attachments`)
- Email attachment metadata
- Storage in DigitalOcean Spaces
- Inline image support (CID)
- Virus scanning status

**InboundMessage** (`inbound_messages`)
- Processed inbound emails linked to tickets
- Sanitized HTML content
- Asset relationships

**MessageAsset** (`message_assets`)
- Extracted images/files from emails
- Multiple variants: original, web, thumb
- SHA256 hashing for deduplication
- Kinds: inline, attachment, derived

**EmailDLQ** (`email_dlq`)
- Dead Letter Queue for failed email processing
- Retry tracking
- Resolution status

**BlockedEmailDomain** (`blocked_email_domains`)
- Spam/blocked domain list
- Audit trail of who/when/why

#### Audit & Compliance

**AuditLog** (`audit_log`)
- Immutable audit trail
- Cryptographic chain verification (prev_hash, hash)
- Actor tracking (user ID, email, type)
- Entity tracking (type, ID, target)
- Request correlation (request_id, correlation_id)
- Field-level change tracking (prev_values, new_values)
- Redaction support (redaction_level)
- IP and User-Agent logging

**AuditLogDLQ** (`audit_log_dlq`)
- Failed audit log entries
- Retry mechanism

**AuditChainVerification** (`audit_chain_verification`)
- Periodic chain integrity verification results
- Tamper detection

#### Staff Management

**StaffPresence** (`staff_presence`)
- Real-time staff availability
- Status: AVAILABLE, VACATION, SICK, REMOTE, IN_OFFICE, AFTER_HOURS
- Office locations: NEWPORT, LAGUNA_BEACH, DANA_POINT
- Date ranges for scheduling

**OfficeHours** (`office_hours`)
- Per-user weekly schedule
- Day of week + start/end time
- Enable/disable specific days

**Holiday** (`holidays`)
- Company-wide holiday calendar
- Date ranges
- Active/inactive toggle

#### AI Assistant

**AidinChatSession** (`aidin_chat_sessions`)
- AI assistant conversation sessions for staff
- Auto-expiration (30 days)
- Session titles

**AidinChatMessage** (`aidin_chat_messages`)
- Individual messages in chat sessions
- Role: user or assistant
- Chronological ordering

#### Analytics

**WeeklyTicketStats** (`weekly_ticket_stats`)
- Pre-aggregated weekly metrics
- Ticket counts by status
- Effectiveness scoring
- Unique per year/week

#### System & Performance

**UserPreference** (`user_preferences`)
- Per-user UI customization
- View ordering (personal, company)
- Dashboard card layout

**RateLimitEntry** (`rate_limit_entries`)
- API rate limiting tracking
- Per-identifier + endpoint
- Auto-expiration

### Database Relationships

```
User
  ├─ 1:N → Ticket (as requester)
  ├─ 1:N → Ticket (as assignee)
  ├─ 1:N → TicketComment
  ├─ 1:N → Attachment
  ├─ 1:N → KnowledgeBase (as creator)
  ├─ M:N → Department (via UserDepartment)
  ├─ M:N → Role (via UserRole)
  ├─ M:N → Module (via UserModuleAccess)
  ├─ 1:1 → UserPreference
  ├─ 1:N → StaffPresence
  ├─ 1:N → OfficeHours
  ├─ 1:N → AidinChatSession
  └─ 1:N → User (manager hierarchy)

Ticket
  ├─ 1:N → TicketComment
  ├─ 1:N → TicketMessage
  ├─ 1:N → Attachment
  ├─ M:N → Tag (via TicketTag)
  ├─ M:N → KnowledgeBase (via TicketKBUsage)
  ├─ 1:N → TicketCC
  ├─ 1:N → InboundMessage
  ├─ 1:N → MessageAsset
  ├─ 1:1 → AIDecision
  └─ 1:N → Ticket (parent-child threading)

Department
  ├─ 1:N → DepartmentKeyword
  ├─ M:N → User (via UserDepartment)
  └─ 1:N → KnowledgeBase

EmailIngest
  ├─ 1:N → EmailAttachment
  └─ 0:1 → Ticket (if converted)
```

---

## 5. API Endpoints

### Authentication (`/api/auth/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/azure/login` | GET | Initiate Azure AD SSO |
| `/api/auth/azure-callback` | GET | Azure AD OAuth callback |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/me` | GET | Get current user info |
| `/api/auth/register` | POST | Create new account |
| `/api/auth/sso-success` | GET | SSO success redirect |
| `/api/auth/dev-login` | POST | Development-only login |

### Tickets (`/api/tickets/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tickets` | GET, POST | List/create tickets |
| `/api/tickets/stats` | GET | Ticket statistics |
| `/api/tickets/merge` | POST | Merge multiple tickets |
| `/api/tickets/send-ai-email` | POST | Send AI-generated response |
| `/api/tickets/add-reply-comment` | POST | Add comment from email reply |
| `/api/tickets/[id]` | GET, PATCH, DELETE | Ticket CRUD |
| `/api/tickets/[id]/comments` | GET, POST | Ticket comments |
| `/api/tickets/[id]/activity` | GET | Activity timeline |
| `/api/tickets/[id]/cc` | GET, POST, DELETE | CC recipients |
| `/api/tickets/[id]/tags` | GET, POST, DELETE | Ticket tags |
| `/api/tickets/[id]/generate-draft` | POST | AI draft response |
| `/api/tickets/[id]/send-draft` | POST | Send drafted response |
| `/api/tickets/[id]/mark-solved` | POST | Mark as solved |
| `/api/tickets/[id]/mark-not-ticket` | POST | Mark as not a ticket |
| `/api/tickets/[id]/save-to-kb` | POST | Convert to KB article |
| `/api/tickets/[id]/satisfaction` | GET, POST | Satisfaction rating |
| `/api/tickets/[id]/email-attachments` | GET | Email attachments |
| `/api/tickets/[id]/upload-draft-image` | POST | Upload inline image |
| `/api/tickets/[id]/upload-draft-file` | POST | Upload attachment |
| `/api/tickets/[id]/link` | POST, DELETE | Link/unlink tickets |
| `/api/tickets/[id]/message-assets` | GET | Ticket message assets |

### Users (`/api/users/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET, POST | List/create users |
| `/api/users/[id]` | GET, PATCH, DELETE | User CRUD |
| `/api/users/[id]/roles` | GET, PUT | User roles |
| `/api/users/[id]/hierarchy` | GET | User hierarchy |
| `/api/users/[id]/check-deletion` | GET | Pre-delete validation |
| `/api/users/bulk-delete` | POST | Delete multiple users |
| `/api/users/hierarchy-view` | GET | Org chart data |

### Admin (`/api/admin/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/departments` | GET, POST | Department management |
| `/api/admin/departments/[id]` | GET, PATCH, DELETE | Department CRUD |
| `/api/admin/keywords` | GET, POST | Classification keywords |
| `/api/admin/keywords/[id]` | PATCH, DELETE | Keyword CRUD |
| `/api/admin/knowledge-base` | GET, POST | KB management |
| `/api/admin/knowledge-base/[id]` | GET, PATCH, DELETE | KB article CRUD |
| `/api/admin/modules` | GET, POST | Module management |
| `/api/admin/role-modules` | GET, POST | Role module access |
| `/api/admin/user-modules` | GET, POST | User module access |
| `/api/admin/ai-decisions` | GET | AI decision logs |
| `/api/admin/audit` | GET | Audit log viewer |
| `/api/admin/audit/actions` | GET | Available audit actions |
| `/api/admin/audit/export` | POST | Export audit logs |
| `/api/admin/audit/verify` | POST | Verify audit chain |
| `/api/admin/settings` | GET, PATCH | System settings |
| `/api/admin/notifications` | GET, POST | System notifications |
| `/api/admin/blocked-domains` | GET, POST | Blocked email domains |
| `/api/admin/blocked-domains/[id]` | DELETE | Unblock domain |

### AI Assistant (`/api/assistant/*`, `/api/aidin-chat/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assistant/chat` | POST | AI assistant conversation |
| `/api/aidin-chat/sessions` | GET, POST | Chat sessions |
| `/api/aidin-chat/sessions/[id]` | GET, DELETE | Session management |
| `/api/aidin-chat/sessions/[id]/messages` | GET, POST | Session messages |

### Knowledge Base (`/api/knowledge-base`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge-base` | GET | Search KB articles |

### Reports & Analytics (`/api/reports/*`, `/api/stats`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/analytics` | GET | Ticket analytics |
| `/api/stats` | GET | Dashboard statistics |
| `/api/weekly-stats` | GET | Weekly statistics |
| `/api/satisfaction-metrics` | GET | Satisfaction scores |
| `/api/categories/analytics` | GET | Category analytics |

### Email Integration (`/api/inbound/*`, `/api/webhooks/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inbound/email` | POST | Process incoming email |
| `/api/inbound/email-reply` | POST | Process email reply |
| `/api/inbound/email-images` | POST | Process email images |
| `/api/webhooks/graph-email` | POST | Microsoft Graph webhook |
| `/api/webhooks/n8n` | POST | n8n workflow webhook |

### Staff Management (`/api/staff-presence/*`, `/api/office-hours`, `/api/holidays`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/staff-presence` | GET, POST | Staff presence status |
| `/api/staff-presence/[id]` | PATCH, DELETE | Update/delete presence |
| `/api/staff-presence/week-view` | GET | Weekly calendar view |
| `/api/office-hours` | GET, POST, PATCH, DELETE | Office hours management |
| `/api/holidays` | GET, POST | Holiday calendar |
| `/api/holidays/[id]` | PATCH, DELETE | Update/delete holiday |

### Miscellaneous

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/attachments` | POST | Upload attachment |
| `/api/attachments/[id]/download` | GET | Download attachment |
| `/api/uploads` | POST | General file upload |
| `/api/avatars/[filename]` | GET | User avatar image |
| `/api/assets/[id]` | GET | Message asset |
| `/api/user-emails` | GET, POST, DELETE | Alternate emails |
| `/api/user-preferences` | GET, PATCH | User preferences |
| `/api/user/modules` | GET | User's accessible modules |
| `/api/azure-sync/status` | GET | Azure AD sync status |
| `/api/azure-sync/sync` | POST | Trigger Azure sync |
| `/api/org-chart` | GET | Organization chart |
| `/api/tags` | GET, POST | Tag management |
| `/api/departments` | GET | Department list |
| `/api/departments/[id]` | GET | Department details |
| `/api/keywords/suggestions` | GET | Keyword suggestions |
| `/api/classifier-feedback/check` | POST | Check for classifier feedback |
| `/api/public/verify-survey-token` | GET | Verify satisfaction survey token |
| `/api/public/submit-satisfaction` | POST | Submit satisfaction rating |
| `/api/jobs/email-polling/start` | POST | Start email polling |
| `/api/jobs/email-polling/stop` | POST | Stop email polling |
| `/api/jobs/email-polling/status` | GET | Email polling status |
| `/api/jobs/email-polling/trigger` | POST | Trigger immediate poll |
| `/api/cron/cleanup-chats` | GET | Cleanup expired chats |
| `/api/debug/session` | GET | Debug session info |
| `/api/debug/ticket/[ticketNumber]` | GET | Debug ticket data |
| `/api/debug/attachments/[ticketNumber]` | GET | Debug attachments |
| `/api/debug/user-modules` | GET | Debug user modules |

**Total: 102+ API endpoints**

---

## 6. Core Modules & Features

### 1. Ticket Management System

**Files:**
- `app/tickets/page.js` - Ticket list view
- `app/tickets/[id]/page.js` - Ticket detail view
- `app/tickets/new/page.js` - Create ticket
- `lib/tickets.js` - Ticket utilities
- `modules/tickets/id.ts` - Ticket ID generation
- `modules/tickets/subject.ts` - Subject parsing

**Features:**
- Multi-view system (My Tickets, Unassigned, All, By Status)
- Custom views (personal & company-wide)
- Drag-and-drop view reordering
- Ticket threading (parent-child relationships)
- Merging tickets
- Status workflow: NEW → OPEN → PENDING/ON_HOLD → SOLVED
- Priority levels: LOW, NORMAL, HIGH, URGENT
- Department-based ticket numbering (IT000123)
- CC recipients (captured from emails + manual)
- Tagging system
- Rich text comments with mentions
- File attachments with auto-expiration
- Email integration (bidirectional)
- AI-powered categorization
- Satisfaction surveys

### 2. Email Integration

**Files:**
- `lib/services/EmailService.js` - Core email service
- `lib/services/MicrosoftGraphService.js` - Graph API integration
- `lib/services/EmailWebhookService.js` - Real-time webhook
- `lib/start-email-polling.js` - Polling service
- `modules/email-polling/` - Polling module (TypeScript)
- `lib/email/` - Email utilities
- `lib/email-images/` - Inline image processing

**Features:**
- **Microsoft 365 Integration**: OAuth 2.0 with Microsoft Graph API
- **Bidirectional Sync**: Inbox monitoring + outbound sending
- **Email Polling**: Configurable interval (default: 1 minute)
- **Webhook Support**: Real-time notification subscriptions
- **Thread Detection**: Conversation tracking via Message-ID headers
- **Auto-Ticket Creation**: Emails → Tickets automatically
- **Email Reply Parsing**: Extracts new content from reply chains
- **Inline Images**: CID resolution and storage
- **Attachment Handling**: Download to DigitalOcean Spaces
- **Deduplication**: Hash-based duplicate detection
- **HTML Sanitization**: XSS protection
- **CC Preservation**: Captures original CC recipients
- **Forwarded Email Parsing**: Extracts quoted content
- **Dead Letter Queue**: Failed email retry mechanism
- **Blocked Domains**: Spam prevention

### 3. AI-Powered Features

**Files:**
- `lib/ai/categorization.js` - Auto-categorization
- `lib/ai/routing.js` - Auto-assignment
- `lib/ai/knowledge-search.js` - KB search
- `lib/ai/response-generation.js` - Draft generation
- `lib/openai.js` - OpenAI client wrapper
- `modules/classify/email.ts` - Email classification
- `components/AIDraftReview.jsx` - Draft review UI
- `components/VirtualAssistant.jsx` - AI chat widget
- `app/aidin-chat/page.js` - AI assistant page

**Features:**
- **Auto-Categorization**: Analyzes ticket content → suggests department
- **Smart Routing**: Assigns to best-fit department/agent
- **KB Search**: Vector-based semantic search
- **Draft Generation**: AI-written response suggestions
- **Learning System**: Classifier feedback loop
- **AidIN Assistant**: ChatGPT-like interface for staff
  - Ticket queries
  - Knowledge base access
  - System help
- **Confidence Scoring**: All AI decisions have confidence levels
- **Override Tracking**: Manual overrides logged for training

### 4. Knowledge Base

**Files:**
- `app/knowledge-base/page.js` - KB management UI
- `lib/ai/knowledge-search.js` - Search functionality

**Features:**
- Rich text articles with images
- Department categorization
- Tag-based organization
- Vector embeddings for AI search
- Usage tracking
- Auto-creation from tickets
- Editor with Tiptap rich text
- Image upload support

### 5. User & Access Management

**Files:**
- `app/users/page.js` - User management
- `app/admin/page.js` - Admin panel
- `lib/auth.js` - Authentication utilities
- `lib/access-control.js` - Authorization
- `lib/module-access.js` - Module-based permissions
- `lib/role-utils.js` - Role utilities
- `modules/auth/` - Auth module (TypeScript)
- `components/AuthProvider.jsx` - Auth context

**Features:**
- **Azure AD Integration**: SSO with Microsoft Entra ID
- **Local Authentication**: Email/password fallback
- **Role-Based Access Control**: Multiple roles per user
- **Module-Based Permissions**: Granular feature access
- **User Types**: Client, Employee, System, REQUESTER
- **User Hierarchy**: Manager-subordinate relationships
- **Department Assignment**: Many-to-many relationship
- **Alternate Emails**: Multiple email addresses per user
- **Profile Management**: Avatar, job title, office location
- **Session Management**: JWT tokens
- **Password Hashing**: bcrypt
- **Account Deactivation**: Soft delete

### 6. Audit Logging

**Files:**
- `lib/audit/` - Audit system (TypeScript)
  - `logger.ts` - Core logger
  - `middleware.ts` - Express/Next.js middleware
  - `verifier.ts` - Chain verification
  - `hash.ts` - Cryptographic hashing
  - `redaction.ts` - PII redaction
  - `integrations.ts` - Hooks
- `lib/services/AuditLogCleanupScheduler.js` - Auto-cleanup
- `app/admin/audit/page.jsx` - Audit log viewer

**Features:**
- **Immutable Logging**: All actions recorded
- **Cryptographic Chain**: Each entry links to previous via hash
- **Tamper Detection**: Periodic verification
- **Actor Tracking**: User ID, email, type, IP, User-Agent
- **Entity Tracking**: What was changed (type, ID)
- **Field-Level Changes**: Before/after values
- **PII Redaction**: Configurable sensitivity levels
- **Request Correlation**: Trace related operations
- **Dead Letter Queue**: Failed audit entries
- **Auto-Cleanup**: Configurable retention (default: 1 year)
- **Export Functionality**: CSV/JSON export
- **Search & Filter**: By action, user, entity, date range

### 7. Reports & Analytics

**Files:**
- `app/reports/page.js` - Reports dashboard
- `components/DraggableStatCard.jsx` - Stats widgets

**Features:**
- **Ticket Analytics**:
  - Tickets by status (pie chart)
  - Tickets over time (line graph)
  - Tickets by department (bar chart)
  - Tickets by priority (donut chart)
- **Weekly Aggregates**: Pre-computed weekly stats
- **Satisfaction Metrics**: Average ratings, response counts
- **Response Time Analysis**: Average resolution time
- **Agent Performance**: Tickets per agent
- **Department Load**: Workload distribution
- **Trend Analysis**: Week-over-week changes
- **Exportable Data**: CSV/PDF export (implied)

### 8. Staff Management & Availability

**Files:**
- `app/staff-directory/page.js` - Staff directory
- `components/StaffPresenceBadge.js` - Presence indicator
- `components/StaffPresenceSelector.js` - Presence editor
- `components/StaffWeekView.js` - Weekly calendar
- `components/OfficeHoursEditor.js` - Hours editor
- `components/HolidayManager.js` - Holiday management
- `components/OrgChart.jsx` - Organization chart
- `components/NetworkOrgChart.jsx` - Interactive org chart
- `components/HierarchicalOrgChart.jsx` - Tree org chart

**Features:**
- **Real-Time Presence**: Where staff are (office, remote, vacation)
- **Office Locations**: Newport, Laguna Beach, Dana Point
- **Weekly Schedule**: Per-user working hours (day/time)
- **Holiday Calendar**: Company-wide holidays
- **Availability Calculator**: Auto-determines if staff available
- **After-Hours Detection**: Knows when outside office hours
- **Visual Indicators**: Color-coded badges
- **Organization Charts**: Multiple visualization types

### 9. Real-Time Updates

**Files:**
- `lib/socket.js` - Socket.IO server setup
- `lib/hooks/useSocket.js` - React hook for WebSocket
- `server.js` - Socket initialization

**Features:**
- **Live Ticket Updates**: Collaborative editing
- **Presence Indicators**: See who's online
- **Notification System**: Real-time alerts
- **Optional Feature**: Disabled by default (feature flag)

### 10. File Storage & Attachments

**Files:**
- `lib/services/AttachmentService.js` - Attachment handling
- `lib/services/AttachmentCleanupScheduler.js` - Auto-cleanup
- `lib/services/EmailAttachmentHandler.js` - Email attachments
- `modules/storage/spaces.ts` - DigitalOcean Spaces integration

**Features:**
- **DigitalOcean Spaces**: S3-compatible storage
- **Auto-Expiration**: Configurable TTL (default: 90 days)
- **Cleanup Scheduler**: Daily cron job
- **Multiple Variants**: Original, web-optimized, thumbnail
- **SHA256 Hashing**: Deduplication
- **Virus Scanning Status**: Track scan results
- **Inline Images**: CID-based email images
- **Draft Attachments**: Temporary storage for drafts
- **Audit Trail**: Deletion logging

### 11. Satisfaction Surveys

**Files:**
- `app/survey/[token]/page.js` - Survey page
- `components/SatisfactionRatingModal.jsx` - Rating modal

**Features:**
- **Tokenized Links**: Secure one-time survey URLs
- **Email Distribution**: Auto-sent after ticket resolution
- **1-5 Rating Scale**: With optional feedback text
- **Public Access**: No login required
- **Metrics Dashboard**: Aggregated satisfaction data

---

## 7. File Breakdown

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, ES module config |
| `next.config.js` | Next.js config: images, webpack, headers |
| `tailwind.config.js` | Tailwind CSS customization |
| `postcss.config.js` | PostCSS plugins |
| `tsconfig.json` | TypeScript compiler options |
| `eslint.config.js` | ESLint rules |
| `jsconfig.json` | JavaScript path mapping |
| `prisma/schema.prisma` | Database schema |
| `components.json` | Shadcn UI config |
| `docker-compose.yml` | Docker setup (if used) |
| `Dockerfile` | Docker image definition |
| `.env` | Environment variables (not in repo) |
| `.env.local` | Local env override |

### Core App Files

| File | Purpose |
|------|---------|
| `server.js` | Custom Node.js server with Socket.IO |
| `middleware.ts` | Next.js middleware for auth/routing |
| `instrumentation.js` | Server startup initialization |
| `app/layout.js` | Root layout with providers |
| `app/page.js` | Home page (redirects to dashboard) |
| `app/globals.css` | Global CSS with Tailwind |

### Key Library Files

| File | Purpose |
|------|---------|
| `lib/prisma.js` | Prisma client singleton |
| `lib/auth.js` | Session management, token verification |
| `lib/auth-client.js` | Client-side auth utilities |
| `lib/api-utils.js` | API response helpers |
| `lib/utils.js` | General utilities (classnames, etc.) |
| `lib/config.ts` | App configuration |
| `lib/cache.js` | In-memory caching |
| `lib/socket.js` | Socket.IO setup |
| `lib/performance.js` | Performance monitoring |

### Schedulers & Background Jobs

| File | Purpose | Schedule |
|------|---------|----------|
| `lib/services/AzureSyncScheduler.js` | Azure AD user sync | Daily (2am) |
| `lib/services/AttachmentCleanupScheduler.js` | Delete expired files | Daily (3am) |
| `lib/services/AuditLogCleanupScheduler.js` | Delete old audit logs | Weekly (Sunday 4am) |
| `lib/start-email-polling.js` | Email inbox polling | Every 1 minute |

### Utility Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-to-production.sh` | Deploy to production server |
| `scripts/sync-azure-user.ts` | Manual Azure AD sync |
| `scripts/setup-email-webhook.js` | Setup Microsoft Graph webhook |
| `scripts/manual-azure-sync.js` | Force Azure sync |
| `scripts/cleanup-expired-chats.js` | Clean old AI chat sessions |
| `scripts/fix-ticket-corruption.js` | Data repair utility |
| `scripts/seed-test-data.js` | Generate test data |
| `scripts/verify-audit-chain.ts` | Verify audit log integrity |
| `scripts/create-ai-assistant.js` | Create system user for AI |
| `scripts/optimize-avatars.sh` | Optimize avatar images |

---

## 8. Infrastructure & Deployment

### Production Environment

**Server**: Ubuntu 24.04 LTS (DigitalOcean Droplet)
**IP**: 64.23.144.99
**Domain**: helpdesk.surterreproperties.com
**App Directory**: `/opt/apps/aidin`

### System Services

**SystemD Service**: `aidin.service`
**Service File**: `/etc/systemd/system/aidin.service`
**User**: www-data
**Environment**: NODE_ENV=production
**Port**: 3011 (internal)
**Logs**:
- App logs: `/var/log/aidin/app.log`
- Error logs: `/var/log/aidin/error.log`

**Service Commands**:
```bash
systemctl start aidin.service
systemctl stop aidin.service
systemctl restart aidin.service
systemctl status aidin.service
journalctl -u aidin.service -f
```

### Nginx Configuration

**Config File**: `/etc/nginx/sites-available/aidin`
**Symlink**: `/etc/nginx/sites-enabled/aidin`

**Features**:
- SSL/TLS termination (Let's Encrypt)
- HTTP → HTTPS redirect
- Reverse proxy to port 3011
- WebSocket support (Socket.IO)
- Rate limiting (login: 5/min, API: 10/sec)
- Gzip compression
- Static asset caching
- Security headers (CSP, HSTS, X-Frame-Options)
- Max body size: 26MB

**SSL Certificate**:
- Provider: Let's Encrypt
- Auto-renewal: certbot
- Cert path: `/etc/letsencrypt/live/helpdesk.surterreproperties.com/`

### Database

**Provider**: DigitalOcean Managed PostgreSQL
**Region**: SFO3
**Connection**: SSL required
**URL**: (in .env) postgresql://doadmin:***@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require

### File Storage

**Provider**: DigitalOcean Spaces
**Bucket**: (configured via env)
**Region**: (configured via env)
**Access**: S3-compatible API (@aws-sdk/client-s3)

### Email Service

**Provider**: Microsoft 365 / Azure AD
**API**: Microsoft Graph API
**Authentication**: OAuth 2.0 with MSAL
**Mailbox**: helpdesk@surterreproperties.com
**Features**:
- Send emails
- Read emails (polling)
- Webhook subscriptions
- Attachment download

### Environment Variables

**Critical Variables**:
```bash
# App
NODE_ENV=production
PORT=3011
NEXT_PUBLIC_APP_URL=https://helpdesk.surterreproperties.com

# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://helpdesk.surterreproperties.com

# Azure AD
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
AZURE_REDIRECT_URI=.../api/auth/azure-callback

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=helpdesk@surterreproperties.com
SMTP_PASS=...
HELPDESK_EMAIL=helpdesk@surterreproperties.com
EMAIL_POLLING_ENABLED=true
EMAIL_POLLING_INTERVAL_MS=60000
ENABLE_EMAIL_WEBHOOK=true
EMAIL_WEBHOOK_BASE_URL=https://helpdesk.surterreproperties.com

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=...
DO_SPACES_REGION=...
DO_SPACES_BUCKET=...
DO_SPACES_ACCESS_KEY=...
DO_SPACES_SECRET_KEY=...

# Features
ENABLE_LIVE_UPDATES=false
AZURE_SYNC_ENABLED=true
AZURE_SYNC_DEV_MODE=false
AUDIT_LOG_RETENTION_DAYS=365
MAX_ATTACHMENT_MB=25
ATTACHMENT_RETENTION_DAYS=90
```

### Deployment Process

**Automated Deployment** (`scripts/deploy-to-production.sh`):
1. SSH to production server
2. Pull latest code from Git
3. Install dependencies (`npm install`)
4. Run database migrations (`npx prisma migrate deploy`)
5. Build Next.js app (`npm run build`)
6. Restart systemd service

**Manual Steps**:
```bash
ssh root@64.23.144.99
cd /opt/apps/aidin
git pull
npm install
npx prisma migrate deploy
npm run build
systemctl restart aidin.service
systemctl status aidin.service
```

---

## 9. Security & Authentication

### Authentication Methods

1. **Azure AD SSO** (Primary)
   - OAuth 2.0 flow
   - MSAL library (@azure/msal-node)
   - Automatic user provisioning
   - Profile sync (name, email, title, avatar)

2. **Email/Password** (Fallback)
   - bcrypt password hashing
   - JWT token authentication
   - 7-day session expiration

3. **System Accounts**
   - AI Assistant (userType: System)
   - No login capability

### Authorization

**Levels**:
1. **User Type**: Client, Employee, System, REQUESTER
2. **Roles**: Admin, Agent, User (customizable)
3. **Module Access**: Granular feature permissions
4. **Department**: Data scoping

**Access Control**:
- Module-based: User can access specific features
- Role-based: Default permissions via roles
- User overrides: Per-user permission grants/revokes

### Security Features

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcrypt with salt |
| **Session Tokens** | JWT (jsonwebtoken, jose) |
| **CSRF Protection** | Next.js built-in |
| **XSS Prevention** | isomorphic-dompurify for HTML sanitization |
| **SQL Injection** | Prisma parameterized queries |
| **Rate Limiting** | Database-backed (RateLimitEntry table) |
| **API Security** | JWT validation middleware |
| **Audit Logging** | Cryptographically chained audit trail |
| **Email Security** | Blocked domain list, DMARC/SPF check (implied) |
| **File Upload Validation** | MIME type checking, size limits |
| **HTTPS Only** | Enforced via nginx HSTS header |
| **Security Headers** | CSP, X-Frame-Options, X-Content-Type-Options |

### Sensitive Data Handling

**Redaction Levels** (Audit Log):
- 0: Full logging (all fields)
- 1: Redact sensitive fields (passwords, tokens)
- 2: Redact PII (emails, names)
- 3: Minimal logging (action only)

**Encrypted Fields**:
- User passwords (bcrypt)
- API keys in environment variables

**Not Encrypted** (but access-controlled):
- Ticket content
- Email content
- Attachments

---

## 10. AI & Automation

### AI Provider

**OpenAI GPT-4o-mini**
- Model: `gpt-4o-mini`
- Library: openai v5.21.0
- Use cases: Categorization, routing, KB search, draft generation, chat

### AI Features Detail

#### 1. Auto-Categorization

**File**: `lib/ai/categorization.js`

**Process**:
1. Extract ticket content (title + description)
2. Fetch active departments with keywords
3. Send to GPT-4o-mini with prompt:
   - Department names & descriptions
   - Associated keywords
   - Ticket text
4. AI responds with:
   - Suggested department
   - Confidence score (0-1)
   - Reasoning
   - Matched keywords
5. Store in AIDecision table

**Prompt Engineering**:
- Few-shot examples
- Keyword weighting
- Confidence thresholds

#### 2. Smart Routing

**File**: `lib/ai/routing.js`

**Process**:
1. Get suggested department from categorization
2. Find best agent in that department:
   - Current workload
   - Availability (staff presence)
   - Skill match (implied)
3. Auto-assign ticket

#### 3. Knowledge Base Search

**File**: `lib/ai/knowledge-search.js`

**Process**:
1. Generate embedding for search query
2. Vector similarity search in KB (embeddings column)
3. Rank by relevance
4. Return top N results

**Embedding Storage**: PostgreSQL text column (JSON serialized vector)

#### 4. Draft Response Generation

**File**: `lib/ai/response-generation.js`

**Process**:
1. Input: Ticket details + context
2. Search KB for relevant articles
3. Prompt GPT-4o-mini:
   - Ticket information
   - Customer question
   - Relevant KB articles
   - Company tone guidelines
4. Generate draft response
5. Store in `Ticket.aiDraftResponse`
6. Staff reviews/edits before sending

**Review UI**: `components/AIDraftReview.jsx`

#### 5. AidIN Chat Assistant

**Files**:
- `components/VirtualAssistant.jsx` - Chat widget
- `app/aidin-chat/page.js` - Full-page chat
- `app/api/assistant/chat/route.js` - Chat API
- `app/api/aidin-chat/sessions/**` - Session management

**Capabilities**:
- Answer questions about system usage
- Search tickets
- Search knowledge base
- Explain features
- Provide system status

**Context**: System documentation + user's accessible data

#### 6. Classifier Feedback Loop

**File**: `app/api/classifier-feedback/check/route.js`

**Process**:
1. Staff can mark AI categorization as incorrect
2. Provide correct category + reason
3. Stored in ClassifierFeedback table
4. Periodic retraining (future feature)

### Automation Features

1. **Auto-Ticket Creation**
   - Email → Ticket automatically
   - Department classification
   - Requester auto-creation

2. **Auto-Assignment**
   - Based on department + workload
   - Staff availability consideration

3. **Auto-Response**
   - Draft generation on demand
   - NOT sent automatically (requires staff approval)

4. **Auto-Tagging**
   - Extract keywords → suggest tags (planned)

5. **Auto-Resolution Detection**
   - Detect resolution keywords in emails (planned)

6. **Scheduled Tasks**
   - Azure AD sync: Daily
   - Attachment cleanup: Daily
   - Audit log cleanup: Weekly
   - Email polling: Every minute
   - Chat cleanup: Daily

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Files** | 437 |
| **Lines of Code** | ~50,000+ (estimated) |
| **Database Models** | 40+ |
| **API Endpoints** | 102+ |
| **React Components** | 62 |
| **NPM Dependencies** | 79 |
| **TypeScript Files** | ~30% |
| **JavaScript Files** | ~70% |
| **Documentation Files** | 30+ Markdown |
| **Scripts** | 30+ |
| **Database Tables** | 40+ |

---

## Technology Mix

**Languages:**
- JavaScript (ES Modules): 70%
- TypeScript: 30%
- SQL (via Prisma): Auto-generated
- Shell scripts: ~10 files
- CSS (Tailwind): Utility classes

**Frontend:**
- React 18 (Server + Client Components)
- Next.js 14 App Router
- Radix UI primitives
- Tailwind CSS
- Framer Motion

**Backend:**
- Next.js API Routes (serverless functions)
- Custom Node.js server (server.js)
- Prisma ORM
- Socket.IO for WebSockets

**Infrastructure:**
- Nginx (reverse proxy)
- SystemD (process management)
- PostgreSQL (database)
- DigitalOcean (hosting + storage)
- Let's Encrypt (SSL)

---

## Key Architectural Patterns

1. **Monolithic Next.js App**: All features in one codebase
2. **API-First Design**: Frontend calls internal APIs
3. **Server Components**: Reduced client JavaScript
4. **Incremental Adoption of TypeScript**: Gradual migration
5. **Service Layer**: Business logic in `lib/services/`
6. **Repository Pattern**: Database access via Prisma
7. **Event-Driven**: Email webhooks, scheduled jobs
8. **Audit Trail**: All mutations logged
9. **Soft Deletes**: Users/tickets marked inactive vs deleted
10. **Optimistic UI**: Client updates before server confirmation

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Runtime** | `npm run dev` (Next.js dev) | `node server.js` (custom) |
| **Port** | 3000 | 3011 |
| **Database** | PostgreSQL (local or dev) | DigitalOcean PostgreSQL |
| **Hot Reload** | Yes | No (requires restart) |
| **SSL** | No | Yes (nginx + Let's Encrypt) |
| **Email Polling** | Optional | Enabled |
| **Azure Sync** | Dev mode | Production mode |
| **Live Updates** | Disabled | Disabled (feature flag) |
| **Audit Logging** | Enabled | Enabled |

---

## Future Enhancements (Implied from TODOs in docs/)

- Advanced AI training with feedback loop
- SLA tracking and alerting
- Mobile app (React Native)
- Multi-language support
- Advanced reporting (Tableau/PowerBI integration)
- Ticket templates
- Canned responses
- Internal knowledge base (staff-only)
- Customer portal
- Live chat widget
- Video attachments
- Voice transcription

---

**End of X-Ray Documentation**

*Generated: October 25, 2025*
*By: Claude Code Assistant*
*For: Surterre Properties Inc.*
