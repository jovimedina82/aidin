# PostgreSQL Migration Guide

This guide walks you through migrating your AIDIN Helpdesk from SQLite to PostgreSQL.

## Database Information

**Database:** `db-postgresql-sfo3-70137`
- **Type:** PostgreSQL 17
- **Tier:** 2 GB RAM / 1 vCPU / 30 GB Disk
- **Region:** SFO3
- **Connection Limit:** 47 concurrent connections
- **Cost:** $24/month

## Connection Details

```
Host: db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com
Port: 25060
Username: doadmin
Password: AVNS_PEyPtMENudp_YP2Jt70
Database: defaultdb
SSL Mode: require
```

## Migration Steps

### 1. Prepare Environment Files

Two environment files are used:

**`.env.local`** (Development - SQLite)
- Keep this for local development
- Uses local SQLite database: `file:./prisma/dev.db`

**`.env.production`** (Production - PostgreSQL)
- Created at: `/Users/owner/aidin/.env.production`
- Contains PostgreSQL connection string
- Use this for production deployment

### 2. Test PostgreSQL Connection (Optional)

Test the connection before migrating:

```bash
# Use the production env temporarily
DATABASE_URL="postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require" npx prisma db execute --stdin <<< "SELECT version();"
```

### 3. Run Migration Script

Execute the automated migration script:

```bash
./scripts/migrate-to-postgresql.sh
```

This script will:
1. ✅ Verify `.env.production` exists
2. ✅ Test PostgreSQL connection
3. ✅ Generate Prisma Client
4. ✅ Deploy all migrations to PostgreSQL
5. ✅ Verify the database setup

### 4. Manual Migration (Alternative)

If you prefer to run commands manually:

```bash
# Set the DATABASE_URL to PostgreSQL
export DATABASE_URL="postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"

# Generate Prisma Client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy

# Verify setup
npx prisma db execute --stdin <<SQL
SELECT
  (SELECT COUNT(*) FROM "users") as user_count,
  (SELECT COUNT(*) FROM "roles") as role_count,
  (SELECT COUNT(*) FROM "departments") as department_count;
SQL
```

### 5. Deploy to Production Server

On your production server (`helpdesk.surterreproperties.com`):

```bash
# SSH into your server
ssh root@helpdesk.surterreproperties.com

# Navigate to your app directory
cd /path/to/aidin

# Copy the .env.production file (or create it manually)
nano .env

# Add the PostgreSQL DATABASE_URL:
DATABASE_URL="postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"

# Run migrations
npx prisma migrate deploy

# Rebuild and restart the application
npm run build
pm2 restart all
```

### 6. Verify Production Deployment

1. Open: https://helpdesk.surterreproperties.com
2. Log in with dev credentials
3. Check that the application loads correctly
4. Create a test ticket
5. Verify data is being saved to PostgreSQL

## Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?sslmode=require
```

**Your Production String:**
```
postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

## Prisma Configuration

Your `prisma/schema.prisma` already supports PostgreSQL. The provider is set to:

```prisma
datasource db {
  provider = "postgresql"  // or "sqlite" for development
  url      = env("DATABASE_URL")
}
```

Prisma will automatically use the correct database based on the `DATABASE_URL` environment variable.

## Important Notes

### ⚠️ Security Recommendations

1. **Change JWT Secret:**
   - Update `JWT_SECRET` in `.env.production` to a secure random string
   - Generate with: `openssl rand -base64 32`

2. **Update Webhook Secrets:**
   - Change `N8N_WEBHOOK_SECRET`
   - Change `REPLY_WEBHOOK_SECRET`
   - Change `GRAPH_WEBHOOK_SECRET`

3. **Keep Credentials Secure:**
   - Never commit `.env.production` to Git
   - Add it to `.gitignore` (already done)
   - Store securely (password manager, vault, etc.)

### 📊 Monitoring

Monitor your database performance in DigitalOcean:
1. Navigate to Databases → `db-postgresql-sfo3-70137`
2. Check the **Insights** tab for:
   - Connection count (should stay under 47)
   - CPU usage (should stay under 80%)
   - Memory usage
   - Slow queries

### 🔄 Connection Pooling

Prisma automatically handles connection pooling. The settings in `.env.production`:
```
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

This ensures efficient connection management for your production environment.

### 📦 Backup Strategy

**Enable Automated Backups:**
1. Go to DigitalOcean Databases
2. Select your database
3. Settings → Backups
4. Enable daily automated backups

**Manual Backup:**
```bash
pg_dump "postgresql://doadmin:AVNS_PEyPtMENudp_YP2Jt70@db-postgresql-sfo3-70137-do-user-23977280-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require" > backup.sql
```

## Scaling Guidelines

### When to Upgrade to 4GB ($48/mo)

- More than 30 concurrent users
- Database connections consistently > 40
- Query response time > 1 second
- Memory usage consistently > 80%

### When to Upgrade to 8GB ($92/mo)

- More than 50 concurrent users
- Heavy reporting/analytics
- Large knowledge base (1000+ articles)
- 1000+ tickets per day

## Rollback Procedure

If you need to rollback to SQLite:

1. Stop the production application
2. Change `DATABASE_URL` back to SQLite in `.env`
3. Run: `npx prisma migrate deploy`
4. Restart the application

## Troubleshooting

### Connection Timeout

If you get connection timeouts:
- Check DigitalOcean firewall settings
- Verify SSL mode is set to `require`
- Ensure your server IP is whitelisted in Network Access

### SSL Certificate Issues

Download the CA certificate if needed:
```bash
wget https://raw.githubusercontent.com/DigitalOcean/dbaas-ca-certificates/main/ca-certificate.crt
```

Add to connection string:
```
?sslmode=require&sslcert=/path/to/ca-certificate.crt
```

### Migration Fails

If migrations fail:
```bash
# Check migration status
npx prisma migrate status

# Resolve failed migrations
npx prisma migrate resolve --applied <migration_name>

# Or reset and rerun
npx prisma migrate reset --force
npx prisma migrate deploy
```

## Support Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/17/
- **DigitalOcean Docs:** https://docs.digitalocean.com/products/databases/postgresql/

## Migration Checklist

- [ ] Created `.env.production` file
- [ ] Tested PostgreSQL connection
- [ ] Ran migration script successfully
- [ ] Verified database tables created
- [ ] Updated production server `.env`
- [ ] Deployed migrations to production
- [ ] Rebuilt and restarted production app
- [ ] Verified application works with PostgreSQL
- [ ] Created test data
- [ ] Enabled automated backups
- [ ] Updated JWT_SECRET
- [ ] Updated webhook secrets
- [ ] Monitored initial performance
- [ ] Documented connection details securely

---

**Migration Date:** 2025-10-12
**Database:** db-postgresql-sfo3-70137
**PostgreSQL Version:** 17
**Prepared by:** Claude Code Assistant
