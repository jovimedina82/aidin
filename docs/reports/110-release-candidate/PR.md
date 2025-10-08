# Release: RC1 — Security Headers, Unified Errors, CI, Docs

Production-ready hardening with global security middleware, unified error model, environment validation, CI automation, and comprehensive documentation. Zero breaking changes.

**Security**:
- Global security headers (HSTS, X-Frame-Options, CSP, etc.)
- CORS with ALLOWED_ORIGINS validation
- Rate limiting: 60 req/min per IP (test-safe, in-memory)

**Error Model**:
- Unified response format: `{ ok: false, error: { code, message } }`
- Standard codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMIT_EXCEEDED, INTERNAL_ERROR
- Automatic mapping: Zod → 400, Prisma conflicts → 409, not found → 404

**Configuration**:
- Zod-validated environment (JWT_SECRET min 32 chars)
- Feature flags: AUTO_ASSIGN_ENABLED, INBOUND_EMAIL_ENABLED, ENABLE_PUBLIC_REGISTRATION
- Provider config: AI_PROVIDER, EMAIL_PROVIDER
- Webhook secrets: N8N_WEBHOOK_SECRET, GRAPH_WEBHOOK_SECRET

**CI/CD**:
- GitHub Actions: lint → build → test on push/PR
- Node 18.x with npm cache

**Documentation**:
- OPERATIONS.md: env vars, secrets rotation, deployment checklist
- ARCHITECTURE.md: modules, patterns, extension points

**Files Modified**: 1 route (error model)
**Risk**: Low (transparent changes, generous rate limits)
