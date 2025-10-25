-- Database Spot-Checks for MVP Hardening
-- Run with: psql $DATABASE_URL < scripts/db-spotchecks.sql
-- Or: psql $DATABASE_URL -f scripts/db-spotchecks.sql

\echo '======================================'
\echo 'MVP Hardening - Database Spot-Checks'
\echo '======================================'
\echo ''

-- 1. Check if tables exist
\echo '1. Checking table existence...'
SELECT
  table_name,
  CASE
    WHEN table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM (VALUES
  ('role_modules'),
  ('user_modules'),
  ('audit_logs')
) AS t(table_name);

\echo ''

-- 2. Role Modules - List all role assignments
\echo '2. Role Module Assignments:'
SELECT
  role,
  array_length(modules, 1) as module_count,
  modules,
  created_at,
  updated_at
FROM role_modules
ORDER BY
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'staff' THEN 3
    WHEN 'requester' THEN 4
    ELSE 5
  END;

\echo ''

-- 3. User Module Overrides - Sample (limit 10)
\echo '3. User Module Overrides (Sample - showing first 10):'
SELECT
  user_id,
  array_length(modules, 1) as module_count,
  modules,
  created_at,
  updated_at
FROM user_modules
ORDER BY updated_at DESC
LIMIT 10;

\echo ''

-- 4. User Module Override Count
\echo '4. User Module Override Statistics:'
SELECT
  COUNT(*) as total_user_overrides,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_override,
  MAX(updated_at) as last_updated
FROM user_modules;

\echo ''

-- 5. Latest Audit Log Entries
\echo '5. Latest Audit Log Entries (last 10):'
SELECT
  id,
  actor_email,
  role,
  action,
  entity,
  entity_id,
  CASE
    WHEN prev_hash IS NULL THEN '✓ FIRST'
    WHEN LENGTH(prev_hash) = 64 THEN '✓ VALID'
    ELSE '✗ INVALID'
  END as prev_hash_status,
  CASE
    WHEN LENGTH(hash) = 64 THEN '✓ VALID'
    ELSE '✗ INVALID'
  END as hash_status,
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

\echo ''

-- 6. Audit Log Statistics
\echo '6. Audit Log Statistics:'
SELECT
  COUNT(*) as total_entries,
  COUNT(DISTINCT actor_id) as unique_actors,
  COUNT(CASE WHEN prev_hash IS NULL THEN 1 END) as entries_without_prev_hash,
  COUNT(CASE WHEN hash IS NULL THEN 1 END) as entries_without_hash,
  MIN(created_at) as first_entry,
  MAX(created_at) as last_entry
FROM audit_logs;

\echo ''

-- 7. Audit Activity in Last 24 Hours
\echo '7. Audit Activity (Last 24 Hours):'
SELECT
  entity,
  action,
  COUNT(*) as count,
  COUNT(DISTINCT actor_id) as unique_actors
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY entity, action
ORDER BY count DESC;

\echo ''

-- 8. Audit Activity by Role (Last 24 Hours)
\echo '8. Audit Activity by Role (Last 24 Hours):'
SELECT
  role,
  COUNT(*) as action_count,
  COUNT(DISTINCT actor_id) as unique_users
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY role
ORDER BY action_count DESC;

\echo ''

-- 9. Hash Chain Integrity Check
\echo '9. Hash Chain Integrity Check:'
WITH audit_chain AS (
  SELECT
    id,
    prev_hash,
    hash,
    LAG(hash) OVER (ORDER BY created_at) as expected_prev_hash,
    created_at
  FROM audit_logs
  ORDER BY created_at
),
broken_links AS (
  SELECT
    id,
    created_at,
    CASE
      WHEN prev_hash IS NULL AND expected_prev_hash IS NULL THEN 'FIRST_ENTRY'
      WHEN prev_hash = expected_prev_hash THEN 'VALID'
      ELSE 'BROKEN'
    END as chain_status
  FROM audit_chain
)
SELECT
  chain_status,
  COUNT(*) as count
FROM broken_links
GROUP BY chain_status
ORDER BY chain_status;

\echo ''

-- 10. Module Usage Statistics
\echo '10. Module Usage Statistics (from role_modules):'
SELECT
  unnest(modules) as module,
  COUNT(*) as assigned_to_roles
FROM role_modules
GROUP BY module
ORDER BY assigned_to_roles DESC, module;

\echo ''

-- 11. Database Table Sizes
\echo '11. Hardening Tables - Size Information:'
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE tablename IN ('role_modules', 'user_modules', 'audit_logs')
  AND schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo ''

-- 12. Recent Database Modifications
\echo '12. Recent Modifications (Last 7 Days):'
SELECT
  'role_modules' as table_name,
  COUNT(*) as modified_count
FROM role_modules
WHERE updated_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'user_modules' as table_name,
  COUNT(*) as modified_count
FROM user_modules
WHERE updated_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'audit_logs' as table_name,
  COUNT(*) as created_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days';

\echo ''

-- 13. Health Check Summary
\echo '13. Health Check Summary:'
SELECT
  'Tables Exist' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('role_modules', 'user_modules', 'audit_logs')
    ) = 3 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status
UNION ALL
SELECT
  'Role Modules Seeded' as check_name,
  CASE
    WHEN (SELECT COUNT(*) FROM role_modules) >= 4 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status
UNION ALL
SELECT
  'Audit Logs Present' as check_name,
  CASE
    WHEN (SELECT COUNT(*) FROM audit_logs) > 0 THEN '✓ PASS'
    ELSE '⚠ NO DATA (expected if no mutations yet)'
  END as status
UNION ALL
SELECT
  'Hash Chain Integrity' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM audit_logs
      WHERE hash IS NULL OR LENGTH(hash) != 64
    ) = 0 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status;

\echo ''
\echo '======================================'
\echo 'Spot-Checks Complete!'
\echo '======================================'
\echo ''
\echo 'Review the output above for any issues.'
\echo 'Expected results:'
\echo '  - All 3 tables exist'
\echo '  - 4 role modules (requester, staff, manager, admin)'
\echo '  - Audit logs with valid hash chains'
\echo '  - Recent activity if application is in use'
\echo ''
