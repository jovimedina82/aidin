# Changelog

All notable changes to the AIDIN Helpdesk project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-08

### Added

#### Security & Infrastructure (Phase 10 - RC1)
- Global security middleware for all `/api/**` routes with 6 security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP)
- CORS protection with `ALLOWED_ORIGINS` environment variable validation
- Rate limiting: 60 requests/minute per IP (test-safe, in-memory store with extension point for Redis)
- Unified error response model with 7 standard error codes (VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMIT_EXCEEDED, INTERNAL_ERROR)
- Environment configuration validation using Zod with startup checks
- GitHub Actions CI workflow (lint → build → test on push/PR)
- Comprehensive operational documentation (OPERATIONS.md, ARCHITECTURE.md)
- RC1 smoke test suite (12 tests)

#### Analytics & Reporting (Phase 9)
- Weekly KPI computation and snapshot storage
- AI-powered category analytics with auto-keyword generation
- Ticket metrics endpoints (`/api/reports/kpis`, `/api/reports/weekly`)
- Dashboard widgets for real-time metrics visualization
- Category distribution analytics with keyword extraction

#### Ticket Workflows (Phase 8)
- Status transition workflow with validation rules
- Auto-assignment system with load balancing
- Workflow policies for status changes
- Feature flags for auto-assignment control

#### Comments System (Phase 7)
- Full CRUD comments API (`/api/v1/tickets/:id/comments`)
- Service/Policy/Repository layered architecture for comments
- RBAC integration with granular permissions
- Internal vs. public comment visibility controls
- Comment author tracking and timestamps

#### Email Integration (Phase 6)
- Inbound email processing with ticket creation
- Email-to-ticket parser with HTML stripping
- Microsoft Graph API webhook support
- SMTP email provider support
- Email provider abstraction layer

#### AI Provider Abstraction (Phase 5)
- Unified AI provider interface (OpenAI, Anthropic)
- Ticket categorization with AI-powered classification
- Configurable provider selection via `AI_PROVIDER` environment variable
- Token management and robust error handling

#### Tickets API (Phase 4)
- RESTful tickets endpoints (`POST /api/v1/tickets`, `GET /api/v1/tickets`)
- Service/Policy/Repository pattern implementation
- Prisma-based data access layer
- Request validation with Zod schemas

#### Authentication & RBAC (Phase 3)
- JWT-based authentication system
- Role-based access control (Admin, Agent, User roles)
- Permission-based authorization guards
- Azure AD integration with automatic user sync
- Auth middleware for protected routes

#### Core Scaffold (Phases 1-2)
- Next.js 14.2.3 application foundation
- Prisma ORM setup with SQLite/PostgreSQL support
- Database schema for users, tickets, comments, roles, permissions
- Project structure with modular architecture
- Development environment configuration

### Changed

#### Phase 10 - RC1
- Migrated error responses to unified error model format
- Updated `.env.example` with all Phase 10 configuration variables
- Enhanced `GET /api/auth/me` with standardized error handling

#### Phase 9
- Improved AI classifier with robust heuristics and token management
- Enhanced email classification to prioritize human intent over domain

#### Phase 8
- Refactored ticket service to support workflow state machine
- Updated ticket policies for status transition validation

#### Phase 6
- Added HTML stripping for email-based tickets to improve readability

### Security

- All API routes now protected with security headers (HSTS, CSP, X-Frame-Options)
- CORS enforced with explicit origin allowlist
- Rate limiting prevents brute force attacks on authentication and ticket creation endpoints
- JWT secrets require minimum 32-character length (enforced at startup)
- Environment validation prevents insecure configurations from starting

### Documentation

- Complete operations guide with deployment checklist, secret rotation, and monitoring
- Architecture documentation covering modules, patterns, and extension points
- Phase reports for Phases 3-10 with comprehensive implementation details
- PR descriptions with technical specifications and migration guides

### Testing

- 228 total tests passing across all phases
- Smoke tests for RC1 security, rate limiting, error model, CORS, and config validation
- Test coverage for comments, tickets, analytics, workflows, AI, and auth modules

### Breaking Changes

None. All Phase 10 changes are backward compatible. Error response format enhanced but existing success payloads preserved.

---

## Release Notes

**v0.1.0 - Release Candidate 1 (RC1)**

This is the first official release of AIDIN Helpdesk, a production-ready helpdesk system with:

- ✅ **Security hardening**: Global middleware, rate limiting, CORS protection
- ✅ **AI-powered features**: Ticket categorization, analytics, keyword extraction
- ✅ **Email integration**: Inbound email processing with Graph API and SMTP support
- ✅ **Comprehensive RBAC**: Role-based permissions for Admins, Agents, and Users
- ✅ **Workflow automation**: Status transitions, auto-assignment, policy enforcement
- ✅ **Analytics dashboard**: Weekly KPIs, category metrics, real-time reporting
- ✅ **Production-ready**: CI/CD, environment validation, operational documentation

**Deployment Requirements**:
- Node.js 18.x or later
- PostgreSQL (production) or SQLite (development)
- JWT_SECRET minimum 32 characters
- Optional: Azure AD for SSO, OpenAI/Anthropic API for AI features

**Migration Notes**:
- No database migrations required for fresh installations
- Existing deployments: Run `npx prisma migrate deploy`
- Update `.env` with Phase 10 configuration variables (see `.env.example`)

For detailed deployment instructions, see `OPERATIONS.md`.
