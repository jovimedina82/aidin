# AIDIN Helpdesk - Operations Guide

## Environment Variables

### Critical Security Variables
```bash
# REQUIRED: Minimum 32 characters
JWT_SECRET="your-secure-jwt-secret-key-min-32-chars-required"

# REQUIRED for webhook security
N8N_WEBHOOK_SECRET="your-n8n-webhook-secret"
GRAPH_WEBHOOK_SECRET="your-microsoft-graph-webhook-secret"
```

### CORS Configuration
```bash
# Comma-separated list of allowed origins
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

### Feature Flags
```bash
AUTO_ASSIGN_ENABLED="false"        # Auto-assign tickets to agents
INBOUND_EMAIL_ENABLED="false"       # Process inbound emails
ENABLE_PUBLIC_REGISTRATION="false"   # Allow public user registration
```

### AI Provider
```bash
AI_PROVIDER="openai"  # or "anthropic"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### Email Provider
```bash
EMAIL_PROVIDER="smtp"  # or "graph"

# SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-app-password"

# Microsoft Graph Configuration
GRAPH_TENANT_ID="your-tenant-id"
GRAPH_CLIENT_ID="your-client-id"
GRAPH_CLIENT_SECRET="your-client-secret"
```

## Secret Rotation

### JWT Secret Rotation
1. Generate new secret: `openssl rand -base64 48`
2. Update `JWT_SECRET` in environment
3. Restart application
4. All users must re-authenticate

### Webhook Secret Rotation
1. Generate new secret: `openssl rand -hex 32`
2. Update webhook configuration in external service (N8N/Microsoft)
3. Update `N8N_WEBHOOK_SECRET` or `GRAPH_WEBHOOK_SECRET`
4. Restart application

## Running Weekly KPI Snapshot

Manual execution (recommended for cron):
```bash
# Using Node
node scripts/report-weekly.ts

# Using tsx
npx tsx scripts/report-weekly.ts
```

Cron schedule example (every Monday at 2 AM):
```cron
0 2 * * 1 cd /path/to/aidin && npx tsx scripts/report-weekly.ts >> /var/log/aidin-kpi.log 2>&1
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing: `npm run test`
- [ ] Build successful: `npm run build`
- [ ] Environment variables configured
- [ ] Database migrations applied: `npx prisma migrate deploy`
- [ ] Secrets rotated if compromised

### Deployment Steps
1. Backup database
2. Pull latest code: `git pull origin main`
3. Install dependencies: `npm ci`
4. Run migrations: `npx prisma migrate deploy`
5. Generate Prisma client: `npx prisma generate`
6. Build application: `npm run build`
7. Restart service: `pm2 restart aidin` or similar

### Post-Deployment
- [ ] Health check: `curl https://yourdomain.com/api/auth/me`
- [ ] Verify KPIs endpoint: GET `/api/reports/kpis`
- [ ] Check logs for errors
- [ ] Test critical workflows (create ticket, add comment)

## Monitoring

### Health Endpoints
- `/api/auth/me` - Authentication check
- `/api/reports/kpis` - Analytics health

### Key Metrics
- Response time (target: <500ms p95)
- Error rate (target: <1%)
- Rate limit hits (monitor for attacks)
- Database connection pool usage

### Log Locations
- Application: stdout/stderr
- Build: `.next/` directory
- Database: `prisma/dev.db` (SQLite)

## Troubleshooting

### "Invalid configuration" error
- Check all required environment variables are set
- Ensure `JWT_SECRET` is at least 32 characters
- Verify no typos in variable names

### CORS errors
- Add client origin to `ALLOWED_ORIGINS`
- Restart application after changes
- Check browser console for specific origin

### Rate limit exceeded
- Check IP address in logs
- Adjust rate limit in `lib/http/ratelimit.ts` if legitimate
- Investigate potential attack if suspicious

### Webhook validation failures
- Verify webhook secret matches external service
- Check request headers for `clientState` (Graph) or signature
- Review logs for specific error messages
