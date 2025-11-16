# Aidin Helpdesk - Developer Quick Start Guide

**Version:** 0.1.0
**Last Updated:** November 16, 2025

---

## Getting Started

### Prerequisites

- **Node.js** 18+ LTS
- **Yarn** 1.22.22
- **PostgreSQL** 14+
- **Git**

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd aidin-helpdesk

# 2. Install dependencies
yarn install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# 4. Setup database
npx prisma generate
npx prisma db push
yarn db:seed  # Optional: sample data

# 5. Start development server
yarn dev

# 6. Access application
open http://localhost:3000
```

---

## Environment Configuration

### Required Variables

```bash
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/aidin"

# Authentication
JWT_SECRET="your-32-character-minimum-secret"
NODE_ENV="development"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Optional Variables

```bash
# AI Providers
OPENAI_API_KEY="sk-..."

# Email (choose SMTP or Graph)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASSWORD="..."

# Development helpers
DEV_LOGIN_ENABLED="true"  # Quick login without password
DEV_ADMIN_EMAIL="admin@example.com"

# Features
ENABLE_LIVE_UPDATES="true"
EMAIL_POLLING_ENABLED="false"  # Disable for development
CSRF_PROTECTION_ENABLED="false"  # Can disable for API testing
```

---

## NPM Scripts

```bash
# Development
yarn dev                 # Start dev server (port 3000)
yarn build              # Build for production
yarn start              # Start production server

# Database
yarn db:generate        # Generate Prisma client
yarn db:push            # Push schema changes
yarn db:studio          # Open Prisma Studio (port 5555)
yarn db:seed            # Seed sample data
yarn db:reset           # Reset database + reseed

# Code Quality
yarn lint               # Run ESLint
yarn type-check         # TypeScript validation
yarn ci:lint            # Lint + type-check (CI)

# Testing
yarn test:e2e           # Run Playwright tests
yarn test:e2e:ui        # Interactive test runner

# Utilities
yarn deadcode:check     # Find unused code (Knip)
yarn openapi:gen        # Generate OpenAPI spec
yarn clean              # Clear .next cache
yarn sync:azure:user    # Sync Azure AD user
```

---

## Project Structure

```
/app/                   # Next.js App Router
  /api/                 # 98 API endpoints
  /dashboard/           # Main dashboard
  /tickets/             # Ticket pages
  /admin/               # Admin panel

/components/            # React components
  /ui/                  # Radix UI primitives

/lib/                   # Core utilities
  /auth/                # Authentication
  /security/            # CSRF, rate limiting
  /audit/               # Audit logging
  /ai/                  # AI integrations
  /services/            # Business logic
  /hooks/               # React hooks

/modules/               # Feature modules
  /auth/                # JWT handling
  /email-polling/       # Background jobs

/prisma/                # Database schema
  schema.prisma         # 38 models
```

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create route file in `/app/api/`:

```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/audit/logger';

export async function GET(request: Request) {
  // 1. Authentication
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Authorization (optional)
  // if (!isAdmin(user)) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  // 3. Business logic
  const data = await prisma.example.findMany();

  // 4. Audit logging (for sensitive operations)
  await logEvent({
    action: 'example.list',
    actorId: user.id,
    actorEmail: user.email,
    actorType: 'human',
    entityType: 'example',
    entityId: 'list',
  });

  // 5. Response
  return NextResponse.json({ data });
}
```

2. Add CSRF protection for mutations:

```typescript
export async function POST(request: Request) {
  // CSRF is automatically checked by middleware for POST/PUT/PATCH/DELETE
  // ...
}
```

---

### Adding a New Database Model

1. Edit `/prisma/schema.prisma`:

```prisma
model Example {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("examples")
}
```

2. Generate Prisma client:

```bash
yarn db:generate
```

3. Push schema changes:

```bash
yarn db:push
```

4. Create migration (for production):

```bash
npx prisma migrate dev --name add_example_model
```

---

### Adding a New React Component

1. Create component file:

```tsx
// components/ExampleComponent.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ExampleProps {
  title: string;
  onAction: () => void;
}

export function ExampleComponent({ title, onAction }: ExampleProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onAction();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Action'}
      </Button>
    </div>
  );
}
```

2. Use in page:

```tsx
// app/example/page.tsx
import { ExampleComponent } from '@/components/ExampleComponent';

export default function ExamplePage() {
  return (
    <div className="container mx-auto p-4">
      <ExampleComponent
        title="Example"
        onAction={() => console.log('Action triggered')}
      />
    </div>
  );
}
```

---

### Working with Authentication

```typescript
// Get current user in API route
import { getCurrentUser } from '@/lib/auth';

const user = await getCurrentUser(request);
// user: { id, email, firstName, lastName, roles: [...] }

// Check roles
import { isAdmin, isStaff, hasRole } from '@/lib/role-utils';

if (isAdmin(user)) {
  // Admin or Manager role
}

if (isStaff(user)) {
  // Admin, Manager, or Staff role
}

if (hasRole(user, 'Custom')) {
  // Specific role check
}

// Module access
import { hasModuleAccess } from '@/lib/module-access';

const canAccess = await hasModuleAccess(user, 'reports');
```

---

### Working with Audit Logging

```typescript
import { logEvent } from '@/lib/audit/logger';

// Log ticket update
await logEvent({
  action: 'ticket.updated',
  actorId: user.id,
  actorEmail: user.email,
  actorType: 'human',
  entityType: 'ticket',
  entityId: ticket.id,
  prevValues: {
    status: 'NEW',
    priority: 'NORMAL'
  },
  newValues: {
    status: 'OPEN',
    priority: 'HIGH'
  },
  metadata: {
    reason: 'escalated',
    source: 'web'
  }
});
```

---

### Working with Email

```typescript
import { sendEmail } from '@/lib/email';

// Send email
await sendEmail({
  to: 'user@example.com',
  subject: 'Ticket Update',
  html: '<h1>Your ticket has been updated</h1>',
  text: 'Your ticket has been updated'
});
```

---

### Working with AI Features

```typescript
import { classifyTicket } from '@/modules/classify/email';

// Classify ticket
const classification = await classifyTicket({
  subject: 'Login issue',
  body: 'I cannot access my account...'
});
// { department: 'IT Support', confidence: 0.85, tags: ['authentication'] }

// Generate AI draft
import { generateDraftResponse } from '@/lib/ai/response-gen';

const draft = await generateDraftResponse(ticket, knowledgeBase);
```

---

### Working with Real-Time Updates

```typescript
// Server: Emit event
import { emitTicketUpdated } from '@/lib/socket';

emitTicketUpdated(ticket);

// Client: Subscribe to events
import { useSocket } from '@/lib/hooks/useSocket';

function TicketList() {
  const { socket } = useSocket();

  useEffect(() => {
    socket.on('ticket:updated', (ticket) => {
      // Update local state
    });

    return () => {
      socket.off('ticket:updated');
    };
  }, [socket]);
}
```

---

## Database Operations

### Common Prisma Patterns

```typescript
import { prisma } from '@/lib/prisma';

// Find with relations
const ticket = await prisma.ticket.findUnique({
  where: { id },
  include: {
    requester: true,
    assignee: true,
    comments: {
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    }
  }
});

// Pagination
const tickets = await prisma.ticket.findMany({
  where: { status: 'OPEN' },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
});

// Transaction
const result = await prisma.$transaction(async (tx) => {
  const ticket = await tx.ticket.create({ data: {...} });
  await tx.ticketMessage.create({ data: {...} });
  return ticket;
});

// Aggregation
const stats = await prisma.ticket.aggregate({
  _count: true,
  _avg: { satisfactionRating: true },
  where: { status: 'SOLVED' }
});
```

---

## Security Best Practices

### Input Validation

```typescript
import { boundNumber } from '@/lib/utils/html-escape';

// Validate numeric input
const limit = boundNumber(parseInt(input), 1, 100, 20);
// Returns: 1-100, or default 20 if invalid
```

### HTML Escaping (XSS Prevention)

```typescript
import { escapeHtml, escapeHtmlWithBreaks } from '@/lib/utils/html-escape';

// In email templates
const safeContent = escapeHtmlWithBreaks(userInput);
```

### Path Validation

```typescript
import { sanitizeFilePath } from '@/lib/utils/html-escape';

const safePath = sanitizeFilePath(userPath, baseDir);
if (!safePath) {
  throw new Error('Invalid path');
}
```

### Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/security/rate-limit';

const { allowed, remaining, retryAfter } = await checkRateLimit(
  identifier,
  '/api/endpoint',
  { maxRequests: 10, windowMs: 60000 }
);

if (!allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter },
    { status: 429 }
  );
}
```

---

## Testing

### E2E Tests (Playwright)

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test('should create ticket', async ({ page }) => {
  await page.goto('/tickets/new');
  await page.fill('input[name="title"]', 'Test Ticket');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/tickets\//);
});
```

Run tests:

```bash
yarn test:e2e
yarn test:e2e:ui  # Interactive mode
```

---

## Debugging

### API Debugging

```typescript
import { logger } from '@/lib/logger';

// Structured logging
logger.info('Processing ticket', { ticketId, userId });
logger.error('Failed to process', { error: error.message, ticketId });
```

### Database Debugging

```bash
# Open Prisma Studio
yarn db:studio

# View in browser
open http://localhost:5555
```

### Performance Debugging

```typescript
// Log slow queries
const start = Date.now();
const result = await prisma.ticket.findMany({...});
console.log(`Query took ${Date.now() - start}ms`);
```

---

## Deployment Preparation

### Build for Production

```bash
# Build
yarn build

# Test production build locally
yarn start
```

### Docker Build

```bash
docker build -f Dockerfile.production -t aidin:latest .
docker run -p 3000:3000 --env-file .env.docker aidin:latest
```

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `JWT_SECRET` (32+ characters)
- [ ] Disable `DEV_LOGIN_ENABLED`
- [ ] Enable `CSRF_PROTECTION_ENABLED`
- [ ] Run `yarn build` successfully
- [ ] Run `yarn lint` with no errors
- [ ] Run `yarn type-check` with no errors
- [ ] Test critical user flows
- [ ] Configure monitoring/alerting
- [ ] Set up database backups

---

## Common Issues & Solutions

### Issue: Prisma Client Not Generated

```bash
# Solution
yarn db:generate
```

### Issue: Database Connection Failed

```bash
# Check DATABASE_URL in .env.local
# Ensure PostgreSQL is running
# Verify connection string format
```

### Issue: JWT_SECRET Not Set

```bash
# Set in .env.local
JWT_SECRET="your-32-character-secret-here"
```

### Issue: TypeScript Errors

```bash
# Check types
yarn type-check

# Regenerate types
yarn db:generate
```

### Issue: CORS Errors

```typescript
// Check next.config.js for CORS settings
// Or use API routes (same-origin)
```

---

## Resources

### Internal Documentation

- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database models
- [AUDIT_LOG.md](AUDIT_LOG.md) - Audit logging

### External Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Radix UI](https://www.radix-ui.com/docs/primitives)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)

---

## Getting Help

1. Check documentation in `/docs/` directory
2. Search codebase for similar implementations
3. Review error logs and stack traces
4. Contact development team

---

**Happy coding!** 🚀

---

**Documentation maintained by:** Claude Code
**Last Updated:** November 16, 2025
