# Email Polling Service - Technical Documentation

## Architecture

This file (`lib/start-email-polling.js`) runs email polling outside of Next.js to avoid webpack bundling issues.

## Critical Dependencies

### TypeScript Support via tsx
- **REQUIRED**: This file imports TypeScript modules (`.ts`) from `modules/classify/` and `modules/tickets/`
- **REQUIREMENT**: The server MUST be started with `tsx` instead of plain `node`
- **package.json**: The `start` script must use `tsx server.js`, NOT `node server.js`

### Import Paths
- TypeScript modules MUST be imported with `.ts` extension:
  - ✅ `await import('../modules/classify/email.ts')`
  - ❌ `await import('../modules/classify/email.js')` - Will fail at runtime
  - ❌ `await import('../modules/classify/email')` - Will fail (requires explicit extension)

## Common Issues

### Issue: "Cannot find module '.../email.js'"
- **Cause**: Imports reference `.js` but files are `.ts`
- **Fix**: Change imports to `.ts` extension
- **Prevention**: Always use `.ts` when importing TypeScript modules

### Issue: "Cannot find module '.../email.ts'"
- **Cause**: Server started with `node` instead of `tsx`
- **Fix**: Update package.json `start` script to use `tsx`
- **Prevention**: Verify PM2 uses `npm start` (which uses tsx)

## Testing After Changes

1. Restart the application: `npx pm2 restart aidin-helpdesk`
2. Check logs: `npx pm2 logs aidin-helpdesk --lines 50`
3. Look for:
   - ✅ `Email polling started`
   - ✅ `Email polling complete: X processed, Y failed`
   - ❌ Any "Cannot find module" errors
4. Send test email to verify ticket creation works

## Module Dependencies

Required TypeScript modules:
- `modules/classify/email.ts` - AI email classification and tagging
- `modules/tickets/id.ts` - Ticket ID generation/reservation

## Why Not Use Next.js Routes?

Email polling runs as a cron job in server.js, outside Next.js request/response cycle.
Using Next.js API routes would require additional HTTP calls and complexity.
