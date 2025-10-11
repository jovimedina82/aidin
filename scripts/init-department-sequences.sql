-- ============================================
-- Department Sequences Initialization Script
-- ============================================
--
-- Purpose: Initialize department sequences for ticket ID generation
-- Usage: sqlite3 prisma/dev.db < scripts/init-department-sequences.sql
--
-- Creates sequences for all supported departments:
-- - IT (Information Technology)
-- - HR (Human Resources)
-- - FIN (Finance/Accounting)
-- - MKT (Marketing)
-- - BRK (Brokerage/Real Estate)
-- - OPS (Operations/Facilities)
-- - LEG (Legal/Compliance)
-- - GN (General/Unclassified)
--

-- Insert department sequences (safe to run multiple times due to ON CONFLICT)
INSERT INTO department_sequences (
  id,
  department_code,
  department_name,
  next_number,
  last_reserved_at
)
VALUES
  (
    hex(randomblob(16)),
    'IT',
    'Information Technology',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'HR',
    'Human Resources',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'FIN',
    'Finance',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'MKT',
    'Marketing',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'BRK',
    'Brokerage',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'OPS',
    'Operations',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'LEG',
    'Legal',
    1,
    datetime('now')
  ),
  (
    hex(randomblob(16)),
    'GN',
    'General',
    1,
    datetime('now')
  )
ON CONFLICT(department_code) DO NOTHING;

-- Verify insertion
SELECT
  department_code,
  department_name,
  next_number,
  datetime(last_reserved_at) as last_reserved_at
FROM department_sequences
ORDER BY department_code;

-- Expected output:
-- BRK|Brokerage|1|2025-10-09 XX:XX:XX
-- FIN|Finance|1|2025-10-09 XX:XX:XX
-- GN|General|1|2025-10-09 XX:XX:XX
-- HR|Human Resources|1|2025-10-09 XX:XX:XX
-- IT|Information Technology|1|2025-10-09 XX:XX:XX
-- LEG|Legal|1|2025-10-09 XX:XX:XX
-- MKT|Marketing|1|2025-10-09 XX:XX:XX
-- OPS|Operations|1|2025-10-09 XX:XX:XX
