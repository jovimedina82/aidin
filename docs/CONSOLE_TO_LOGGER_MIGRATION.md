# Console.log to Structured Logger Migration Guide

## Overview

This document provides guidance for migrating from `console.log/warn/error` statements to the new structured logger (`@/lib/logger`).

**Total statements to migrate:** ~312 in `/app/api`

## New Logger Usage

```typescript
import logger from '@/lib/logger';

// Instead of console.log
logger.info('Message', { context: 'data' });

// Instead of console.warn
logger.warn('Warning message', { details: 'info' });

// Instead of console.error
logger.error('Error occurred', error, { additionalContext: 'data' });

// For debug-only logs (won't appear in production unless LOG_LEVEL=debug)
logger.debug('Debug info', { data: 'sensitive' });
```

## Benefits

1. **Log Levels** - Production only shows `info` and above by default
2. **Structured Output** - JSON format for log aggregators
3. **Automatic Redaction** - Sensitive fields (password, token, secret) are redacted
4. **Context Preservation** - Add request IDs, user IDs, IPs
5. **Error Handling** - Proper stack traces in dev, sanitized in prod
6. **No Stack Traces in Production** - Prevents information leakage

## Migration Pattern

### Before:
```javascript
console.log('User registered:', user.email)
console.error('Database error:', error)
console.warn('Rate limit exceeded for', ip)
```

### After:
```javascript
import logger from '@/lib/logger'

logger.info('User registered', { email: user.email })
logger.error('Database error', error)
logger.warn('Rate limit exceeded', { ip })
```

## Priority Files to Migrate

### High Priority (Security-Sensitive):
1. `app/api/auth/*.js` - All auth endpoints ✅ (partially done)
2. `app/api/webhooks/*.js` - Webhook handlers
3. `app/api/inbound/*.ts` - Email processing
4. `lib/audit/*.js` - Audit logging
5. `lib/security/*.ts` - Security utilities

### Medium Priority (Data Exposure Risk):
1. `app/api/tickets/*.js` - Ticket operations
2. `app/api/users/*.js` - User management
3. `app/api/admin/*.js` - Admin operations
4. `lib/email.js` - Email service

### Low Priority (Less Sensitive):
1. `app/api/stats/*.js` - Statistics
2. `app/api/departments/*.js` - Department management
3. `components/*.tsx` - Frontend components

## Environment Configuration

Add to `.env`:
```bash
# Log level: debug, info, warn, error
# Default: info in production, debug in development
LOG_LEVEL=info
```

## Quick Migration Script

For bulk migration, use this regex pattern in your editor:

Find: `console\.log\((.*)\)`
Replace with: `logger.info($1)`

Find: `console\.warn\((.*)\)`
Replace with: `logger.warn($1)`

Find: `console\.error\((.*)\)`
Replace with: `logger.error($1)`

**Note:** Manual review is required after bulk replacement to:
1. Add proper imports
2. Convert string concatenation to object context
3. Add meaningful message strings
4. Handle error objects properly

## Testing

After migration, test with:
```bash
# Development (verbose)
LOG_LEVEL=debug npm run dev

# Production-like (minimal)
NODE_ENV=production npm run start
```

## Files Already Migrated

- ✅ `/app/api/debug/ticket/[ticketNumber]/route.ts`
- ✅ `/app/api/debug/attachments/[ticketNumber]/route.ts`
- ✅ `/app/api/auth/register/route.js`
- ✅ `/app/api/azure-sync/status/route.js`
- ✅ `/app/api/auth/dev-login/route.ts`

## Next Steps

1. Run `grep -r "console\." app/api --include="*.js" --include="*.ts" | wc -l` to track progress
2. Migrate high-priority files first
3. Add `LOG_LEVEL` to `.env.example`
4. Update deployment documentation
5. Set up log aggregation service (e.g., Datadog, Logtail)

## Estimated Effort

- High Priority (50 files): ~4-6 hours
- Medium Priority (40 files): ~3-4 hours
- Low Priority (35 files): ~2-3 hours
- **Total:** ~10-13 hours for full migration

Recommend migrating incrementally during regular development cycles.
