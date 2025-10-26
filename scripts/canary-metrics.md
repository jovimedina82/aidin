# Canary Metrics — MVP Hardening Rollout

This document defines what metrics to monitor during the gradual rollout of MVP hardening features (10% → 50% → 100%).

## Overview

Use canary deployment to safely roll out features:
1. **10%** - Enable for small subset of users
2. **Monitor for 24 hours** - Watch metrics below
3. **50%** - If healthy, enable for half of users
4. **Monitor for 24 hours** - Continue watching
5. **100%** - Full rollout if metrics remain healthy

## Critical Metrics

### 1. HTTP 5xx Error Rate

**What:** Percentage of requests returning 500-599 status codes

**Threshold:** <0.5% (baseline + 0.2%)

**Why:** Indicates server-side failures, crashes, or misconfigurations

**Where to Monitor:**
- Application logs: `journalctl -u aidin.service | grep -E "5[0-9]{2}"`
- Nginx access logs: `grep -E " 5[0-9]{2} " /var/log/nginx/access.log`
- APM Dashboard (if available): Error rate panel

**Query Example:**
```bash
# Count 5xx errors in last hour
grep -E " 5[0-9]{2} " /var/log/nginx/access.log | \
  awk -v d="$(date --date='1 hour ago' '+%d/%b/%Y:%H')" '$4 > "["d' | \
  wc -l
```

**Action if Threshold Exceeded:**
- 🟡 0.5-1%: Investigate but don't rollback yet
- 🔴 >1%: Rollback feature flag immediately
- 🔴 >5%: Emergency rollback + all hands

---

### 2. P95 API Latency

**What:** 95th percentile response time for API requests

**Threshold:** No regression >10% from baseline

**Why:** Guards and audit logging add overhead; excessive increase indicates performance issues

**Baseline:** Measure before rollout
```bash
# Get baseline P95 from logs (example)
tail -10000 /var/log/nginx/access.log | \
  awk '{print $NF}' | \
  sort -n | \
  awk '{a[NR]=$0} END {print a[int(NR*0.95)]}'
```

**Where to Monitor:**
- Nginx logs: Request duration (last field)
- Application logs: `Request took Xms` messages
- APM Dashboard: Latency percentiles panel

**Action if Threshold Exceeded:**
- 🟡 10-20% increase: Monitor closely, investigate
- 🔴 >20% increase: Rollback and optimize
- 🔴 >50% increase: Emergency rollback

---

### 3. Database Errors

**What:** Count of database connection errors, query failures, deadlocks

**Threshold:** Zero (or baseline level)

**Why:** New tables/queries might cause issues; audit logging adds DB load

**Where to Monitor:**
```bash
# Application logs
journalctl -u aidin.service | grep -iE "database|prisma|postgres" | grep -iE "error|fail"

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log | grep ERROR

# Check for connection exhaustion
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

**Action if Errors Detected:**
- 🟡 1-5 errors: Investigate cause
- 🔴 >5 errors/min: Rollback immediately
- 🔴 Connection pool exhausted: Emergency scale DB or rollback

---

### 4. AuditLog Inserts Per Minute

**What:** Rate of audit log entries being created

**Threshold:** Should match mutation rate (non-zero when mutations occur)

**Why:** Validates audit logging is working; sudden drop indicates failure

**Query:**
```sql
-- Audit inserts in last hour
SELECT
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as inserts
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC
LIMIT 60;
```

**Expected:**
- Non-zero during business hours
- Correlates with user activity
- Should not be zero if mutations happening

**Action if Zero (when mutations occurring):**
- 🔴 Audit logging broken - investigate immediately
- Check application logs for audit write failures
- Verify database permissions

---

### 5. HTTP 403 Error Rate

**What:** Forbidden errors (access denied)

**Threshold:** <1% after route guards enabled

**Why:** Guards may block legitimate access if misconfigured

**Where to Monitor:**
```bash
# Count 403s in last hour
grep " 403 " /var/log/nginx/access.log | \
  awk -v d="$(date --date='1 hour ago' '+%d/%b/%Y:%H')" '$4 > "["d' | \
  wc -l
```

**Expected After Enabling Guards:**
- Small increase is normal (catching unauthorized access)
- Should stabilize after initial spike
- Monitor user complaints

**Action if Excessive:**
- 🟡 1-2%: Review which users affected
- 🔴 >2%: Check module assignments, may need fixes
- 🔴 >5% or complaints: Rollback and fix permissions

---

### 6. Active User Count

**What:** Number of unique users making requests

**Threshold:** Should not drop >10% from baseline

**Why:** If features break user flows, users will stop using app

**Query:**
```sql
-- Active users in last hour
SELECT COUNT(DISTINCT user_id) as active_users
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Or from application logs:**
```bash
# Unique user IDs from logs
journalctl -u aidin.service --since "1 hour ago" | \
  grep -oP 'userId: \K\w+' | \
  sort -u | \
  wc -l
```

**Action if Drop Detected:**
- 🟡 10-20% drop: Investigate user complaints
- 🔴 >20% drop: Likely blocking legitimate access, rollback
- 🔴 >50% drop: Emergency rollback

---

### 7. Database Table Sizes

**What:** Growth rate of new tables

**Threshold:** Reasonable growth based on activity

**Query:**
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE tablename IN ('role_modules', 'user_modules', 'audit_logs')
  AND schemaname = 'public'
ORDER BY bytes DESC;
```

**Expected:**
- `role_modules`: ~8KB (4 rows, stable)
- `user_modules`: Varies by user count
- `audit_logs`: Grows continuously (~500 bytes/entry)

**Action if Unexpected Growth:**
- 🟡 Audit log growing faster than expected: Normal if activity increased
- 🔴 User_modules exploding: Investigate bulk assignments
- 🔴 Any table >1GB in first week: Investigate

---

## Monitoring Dashboard (Template)

If using Grafana/Datadog/etc., create dashboard with these panels:

### Panel 1: Error Rates
```
Query: rate(http_requests_total{status=~"5.."}[5m])
Alert: > 0.005 (0.5%)
```

### Panel 2: Latency Percentiles
```
Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
Alert: > baseline * 1.1
```

### Panel 3: Database Errors
```
Query: rate(db_errors_total[5m])
Alert: > 0
```

### Panel 4: Audit Log Inserts
```
Query: rate(audit_log_inserts_total[5m])
Alert: < 0.01 AND mutations_total > 0
```

### Panel 5: 403 Rate
```
Query: rate(http_requests_total{status="403"}[5m])
Alert: > 0.01 (1%)
```

---

## Triage Playbook

### Scenario 1: 5xx Errors Spike

**Symptoms:** Error rate >1%, users reporting "something went wrong"

**Steps:**
1. Check application logs for stack traces:
   ```bash
   journalctl -u aidin.service -n 500 | grep -A 10 "Error"
   ```

2. Identify error pattern (all routes or specific?)

3. If related to new features:
   - Rollback feature flag immediately
   - File incident report
   - Fix and re-test in staging

4. If unrelated to hardening:
   - Check database connectivity
   - Check external service dependencies
   - Review recent deployments

### Scenario 2: Latency Degradation

**Symptoms:** P95 >20% higher than baseline

**Steps:**
1. Check slow query log:
   ```bash
   tail -100 /var/log/postgresql/postgresql-*.log | grep "duration:"
   ```

2. Identify if audit writes are slow:
   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   WHERE query LIKE '%audit_logs%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. If audit logging is bottleneck:
   - Consider async audit writes
   - Add database indexes
   - Scale database

4. If route guards are slow:
   - Profile permission check queries
   - Cache role/module lookups
   - Optimize guard logic

### Scenario 3: Users Can't Access Features

**Symptoms:** 403 errors, user complaints, support tickets

**Steps:**
1. Identify affected users:
   ```bash
   grep " 403 " /var/log/nginx/access.log | \
     grep "/api/" | \
     tail -100
   ```

2. Check user's permissions:
   ```sql
   -- Replace USER_ID with actual user
   SELECT * FROM user_modules WHERE user_id = 'USER_ID';
   SELECT r.* FROM role_modules r
   JOIN users u ON u.role = r.role
   WHERE u.id = 'USER_ID';
   ```

3. If missing permissions:
   - Assign via admin UI or SQL
   - Re-run seed script if role defaults wrong

4. If emergency:
   - Temporarily promote user to admin
   - Rollback guards
   - Fix permissions, re-enable

### Scenario 4: Audit Logs Not Writing

**Symptoms:** Zero audit inserts despite mutations happening

**Steps:**
1. Check application logs for audit errors:
   ```bash
   journalctl -u aidin.service | grep -i audit | grep -iE "error|fail"
   ```

2. Verify database table exists:
   ```sql
   SELECT COUNT(*) FROM audit_logs;
   ```

3. Test audit write manually:
   ```sql
   INSERT INTO audit_logs (
     actor_id, actor_email, role, action, entity, hash
   ) VALUES (
     'test', 'test@test.com', 'admin', 'test', 'test', 'test123'
   );
   ```

4. If writes failing:
   - Check database permissions
   - Check table schema matches code
   - Review Prisma client generation

---

## Rollback Decision Matrix

| Metric | Threshold | Action |
|--------|-----------|--------|
| 5xx Error Rate | 0.5-1% | 🟡 Investigate |
| 5xx Error Rate | >1% | 🔴 Rollback |
| P95 Latency | +10-20% | 🟡 Monitor closely |
| P95 Latency | >+20% | 🔴 Rollback |
| Database Errors | 1-5/min | 🟡 Investigate |
| Database Errors | >5/min | 🔴 Rollback |
| Audit Inserts | Zero | 🔴 Investigate immediately |
| 403 Rate | 1-2% | 🟡 Review permissions |
| 403 Rate | >2% | 🔴 Fix or rollback |
| Active Users | -10-20% | 🟡 Investigate |
| Active Users | >-20% | 🔴 Rollback |

---

## Success Criteria

Canary is successful when after 24 hours at each stage:
- ✅ 5xx error rate remains <0.5%
- ✅ P95 latency regression <10%
- ✅ Zero database errors
- ✅ Audit logs writing correctly
- ✅ 403 rate stable and <1%
- ✅ Active users stable or growing
- ✅ No user complaints about access
- ✅ All smoke tests passing

## Contacts

- **On-Call Engineer:** [Phone/Slack]
- **Database Admin:** [Phone/Slack]
- **Product Manager:** [Slack/Email]

## Monitoring Commands Quick Reference

```bash
# Error rate (last hour)
grep -E " [45][0-9]{2} " /var/log/nginx/access.log | wc -l

# Recent errors
journalctl -u aidin.service -n 100 | grep -i error

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Recent audit entries
psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';"

# Slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;"
```
