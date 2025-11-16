# AIDIN Helpdesk - Documentation Index

Welcome to the AIDIN Helpdesk documentation repository for **Surterre Properties**.

**Version:** 0.1.0 | **Last Updated:** November 16, 2025 | **System Resilience Score:** 9.2/10

---

## 🚀 System Overview

Aidin is an AI-powered enterprise helpdesk system built with:
- **Next.js 14.2.3** + React 18 + TypeScript 5.6.3
- **PostgreSQL** with Prisma ORM (38 models, 5 enums)
- **98 API endpoints** across 12 categories
- **AI-powered** ticket management (OpenAI/Anthropic)
- **Real-time updates** via Socket.IO
- **Enterprise security** with RBAC, CSRF, rate limiting

---

## 📋 Table of Contents

### 📐 System Architecture (NEW - November 2025)
Complete system architecture and design documentation.

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** | **Complete system architecture** - 38 models, 98 endpoints, tech stack | System overview |
| **[API_REFERENCE.md](API_REFERENCE.md)** | **Complete API reference** - All 98 endpoints with examples | API integration |
| **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** | **Database schema** - All models, relationships, indexes | Database work |
| **[CRITICAL_FIXES_PHASE2_2025_11_16.md](../CRITICAL_FIXES_PHASE2_2025_11_16.md)** | Security & resilience fixes | Recent improvements |
| **[POTENTIAL_FAILURES_AUDIT.md](../POTENTIAL_FAILURES_AUDIT.md)** | Risk assessment & mitigation | Security review |

**Quick Start:**
```bash
yarn install && yarn dev
# Visit: http://localhost:3000
```

---

### 🔒 Audit Log System
Complete production-grade audit log with tamper-evident hash chain.

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[AUDIT_LOG_SUMMARY.md](AUDIT_LOG_SUMMARY.md)** | Start here! Delivery summary & quick start | First time setup |
| **[AUDIT_LOG_QUICK_REFERENCE.md](AUDIT_LOG_QUICK_REFERENCE.md)** | Developer cheat sheet with code patterns | Daily development |
| **[AUDIT_INTEGRATION_GUIDE.md](AUDIT_INTEGRATION_GUIDE.md)** | Exact integration points in AIDIN code | Adding audit calls |
| **[AUDIT_LOG.md](AUDIT_LOG.md)** | Complete reference (500+ lines) | Deep dive / troubleshooting |
| **[AUDIT_LOG_ARCHITECTURE.md](AUDIT_LOG_ARCHITECTURE.md)** | System design & data flow diagrams | Understanding internals |
| **[AUDIT_LOG_FILES.md](AUDIT_LOG_FILES.md)** | Complete file index & checklist | File organization |

**Quick Start:**
```bash
./scripts/setup-audit-log.sh
# Then visit: http://localhost:3000/admin/audit
```

---

### ✉️ Email System

| Document | Description |
|----------|-------------|
| **[EMAIL_WEBHOOK_SETUP.md](EMAIL_WEBHOOK_SETUP.md)** | Microsoft Graph webhook configuration |
| **[EMAIL_ATTACHMENTS_SETUP.md](EMAIL_ATTACHMENTS_SETUP.md)** | Handling email attachments |
| **[EMAIL-REPLY-THREADING.md](EMAIL-REPLY-THREADING.md)** | Email conversation threading |
| **[EMAIL-SENDING-FIX-2025-10-07.md](EMAIL-SENDING-FIX-2025-10-07.md)** | Email sending implementation fixes |
| **[EMAIL-AUTO-REPLY-FIX.md](EMAIL-AUTO-REPLY-FIX.md)** | Auto-reply functionality |
| **[EMAIL-CLASSIFICATION-FIX.md](EMAIL-CLASSIFICATION-FIX.md)** | Email classification system |
| **[FIX-EMAIL-CONVERSATION-ID.md](FIX-EMAIL-CONVERSATION-ID.md)** | Conversation ID tracking |

---

### 🤖 AI Features

| Document | Description |
|----------|-------------|
| **[AI_DRAFT_FEATURES.md](AI_DRAFT_FEATURES.md)** | AI draft response system |
| **[AI-AUTO-REPLY-GUIDE.md](AI-AUTO-REPLY-GUIDE.md)** | AI auto-reply implementation guide |
| **[AI-AUTO-REPLY-STATUS.md](AI-AUTO-REPLY-STATUS.md)** | AI auto-reply status & configuration |
| **[CLASSIFIER-FEEDBACK-INTEGRATION.md](CLASSIFIER-FEEDBACK-INTEGRATION.md)** | AI classifier feedback system |
| **[NOT-A-TICKET-FEATURE.md](NOT-A-TICKET-FEATURE.md)** | "Not a Ticket" classification |

---

### 📎 Attachments & Storage

| Document | Description |
|----------|-------------|
| **[ATTACHMENT_SYSTEM.md](ATTACHMENT_SYSTEM.md)** | File upload, storage, and expiration system |

---

### 📚 Knowledge Base

| Document | Description |
|----------|-------------|
| **[KB-AUTO-CREATION.md](KB-AUTO-CREATION.md)** | Auto-create KB articles from tickets |

---

### ⚙️ System Configuration

| Document | Description |
|----------|-------------|
| **[AUTO-ASSIGN-ON-SEND.md](AUTO-ASSIGN-ON-SEND.md)** | Auto-assignment when sending replies |
| **[LIVE_UPDATES.md](LIVE_UPDATES.md)** | Real-time updates with WebSockets |
| **[CPU-MONITORING.md](CPU-MONITORING.md)** | CPU monitoring and performance |
| **[MONITORING-NOTES.md](MONITORING-NOTES.md)** | General monitoring guidelines |

---

### 📝 Change Logs

| Document | Description |
|----------|-------------|
| **[CHANGES-SUMMARY-2025-10-07.md](CHANGES-SUMMARY-2025-10-07.md)** | Summary of changes as of Oct 7, 2025 |

---

## 🚀 Quick Navigation

### For New Developers
1. Read [AUDIT_LOG_SUMMARY.md](AUDIT_LOG_SUMMARY.md) to understand the audit system
2. Review [AI_DRAFT_FEATURES.md](AI_DRAFT_FEATURES.md) for AI capabilities
3. Check [EMAIL_WEBHOOK_SETUP.md](EMAIL_WEBHOOK_SETUP.md) for email integration

### For Adding Features
1. **Adding Audit Logging:** [AUDIT_INTEGRATION_GUIDE.md](AUDIT_INTEGRATION_GUIDE.md)
2. **AI Integration:** [AI-AUTO-REPLY-GUIDE.md](AI-AUTO-REPLY-GUIDE.md)
3. **Email Features:** [EMAIL-REPLY-THREADING.md](EMAIL-REPLY-THREADING.md)

### For Troubleshooting
1. **Audit Issues:** [AUDIT_LOG.md](AUDIT_LOG.md) - Section 10 (Troubleshooting)
2. **Email Issues:** [EMAIL-SENDING-FIX-2025-10-07.md](EMAIL-SENDING-FIX-2025-10-07.md)
3. **Performance:** [CPU-MONITORING.md](CPU-MONITORING.md)

### For System Admins
1. **Audit Operations:** [AUDIT_LOG.md](AUDIT_LOG.md) - Section 11 (Operations Runbook)
2. **Monitoring:** [MONITORING-NOTES.md](MONITORING-NOTES.md)
3. **Email Setup:** [EMAIL_WEBHOOK_SETUP.md](EMAIL_WEBHOOK_SETUP.md)

---

## 📊 Documentation by Feature Area

### Core Systems
- **Ticketing:** Multiple docs (see Email, AI sections)
- **Audit Logging:** 6 comprehensive docs (see above)
- **Email Integration:** 7 docs covering all aspects
- **AI/ML:** 5 docs for classification, auto-reply, drafts

### Supporting Systems
- **Attachments:** 1 comprehensive doc
- **Knowledge Base:** 1 doc
- **Real-time Updates:** 1 doc
- **Monitoring:** 2 docs

---

## 🆕 Latest Additions (November 2025)

### Complete System Documentation ✨ (NEW)
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Full system architecture (38 models, 98 endpoints)
- **[API_REFERENCE.md](API_REFERENCE.md)** - Complete API documentation with examples
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Full database schema with all relationships
- Security resilience improvements (score: 9.2/10)
- Circuit breaker patterns for external APIs
- Database transactions for data integrity
- Dead letter queue for failed operations

### Production-Grade Audit Log System ✨
- Complete tamper-evident audit trail
- Hash chain integrity verification
- System actor enforcement for automations
- Multi-level redaction policies
- Admin-only UI with streaming exports
- 6 comprehensive documentation files
- 24 implementation files (library, UI, API, tests)

See [AUDIT_LOG_SUMMARY.md](AUDIT_LOG_SUMMARY.md) for complete details.

---

## 🛡️ Security Improvements (November 2025)

Recent critical security and resilience fixes:

1. **Race Condition Fix** - Email idempotency via database constraints
2. **Database Transactions** - Atomic operations for email ingestion
3. **Circuit Breaker** - Resilience for Graph API, OpenAI, N8N
4. **Fetch Timeouts** - 30s timeout with exponential backoff
5. **Path Traversal Prevention** - Boundary validation for file access
6. **XSS Prevention** - HTML escaping utilities
7. **Input Validation** - Bounds checking for query parameters
8. **Dead Letter Queue** - Failed background task tracking

See [CRITICAL_FIXES_PHASE2_2025_11_16.md](../CRITICAL_FIXES_PHASE2_2025_11_16.md) for details.

---

## 📁 Reports Directory

The `reports/` subdirectory contains generated reports and analytics.

---

## 🔗 External Resources

- **GitHub:** (Add your repo URL)
- **Staging:** (Add staging URL)
- **Production:** (Add production URL)
- **Microsoft Graph Docs:** https://learn.microsoft.com/en-us/graph/

---

## 📧 Support

For questions or issues:
1. Check the relevant documentation above
2. Review troubleshooting sections
3. Contact the development team

---

**Last Updated:** November 16, 2025
**Version:** 2.1.0 (with Complete System Documentation)
**System Resilience Score:** 9.2/10
