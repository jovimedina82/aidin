-- Production-Grade Audit Log System for AIDIN Helpdesk
-- Tamper-evident append-only log with hash chain integrity

-- Drop existing audit_logs table (old simple version)
DROP TABLE IF EXISTS "audit_logs";

-- Create new audit_log table with hash chain and comprehensive tracking
CREATE TABLE "audit_log" (
    "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "ts" DATETIME NOT NULL DEFAULT (datetime('now', 'utc')),
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_email" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL CHECK ("actor_type" IN ('human', 'system', 'service')),
    "impersonated_user" TEXT,
    "entity_type" TEXT NOT NULL CHECK ("entity_type" IN ('ticket', 'comment', 'message', 'user', 'attachment', 'setting', 'integration', 'rule', 'email')),
    "entity_id" TEXT NOT NULL,
    "target_id" TEXT,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "prev_values" TEXT, -- JSON
    "new_values" TEXT,  -- JSON
    "metadata" TEXT,    -- JSON
    "redaction_level" INTEGER NOT NULL DEFAULT 0 CHECK ("redaction_level" IN (0, 1, 2)),
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL
);

-- Indexes for high-performance queries
CREATE INDEX "idx_audit_log_ts" ON "audit_log"("ts" DESC);
CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id", "ts" DESC);
CREATE INDEX "idx_audit_log_action" ON "audit_log"("action", "ts" DESC);
CREATE INDEX "idx_audit_log_actor" ON "audit_log"("actor_email", "ts" DESC);
CREATE INDEX "idx_audit_log_request" ON "audit_log"("request_id") WHERE "request_id" IS NOT NULL;
CREATE INDEX "idx_audit_log_correlation" ON "audit_log"("correlation_id") WHERE "correlation_id" IS NOT NULL;

-- Unique partial index for idempotency (prevent duplicate events)
CREATE UNIQUE INDEX "idx_audit_log_idempotent" ON "audit_log"("action", "entity_id", "request_id")
WHERE "request_id" IS NOT NULL;

-- Trigger to prevent UPDATE operations (append-only enforcement)
CREATE TRIGGER "prevent_audit_log_update"
BEFORE UPDATE ON "audit_log"
BEGIN
    SELECT RAISE(ABORT, 'UPDATE operations are not allowed on audit_log table - append-only');
END;

-- Trigger to prevent DELETE operations (append-only enforcement)
CREATE TRIGGER "prevent_audit_log_delete"
BEFORE DELETE ON "audit_log"
BEGIN
    SELECT RAISE(ABORT, 'DELETE operations are not allowed on audit_log table - append-only');
END;

-- Dead letter queue for failed audit events
CREATE TABLE "audit_log_dlq" (
    "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "failed_at" DATETIME NOT NULL DEFAULT (datetime('now', 'utc')),
    "error" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_retry_at" DATETIME,
    "event_data" TEXT NOT NULL, -- JSON of the event that failed
    "resolved" INTEGER NOT NULL DEFAULT 0, -- Boolean
    "resolved_at" DATETIME
);

CREATE INDEX "idx_audit_dlq_failed" ON "audit_log_dlq"("failed_at" DESC);
CREATE INDEX "idx_audit_dlq_unresolved" ON "audit_log_dlq"("resolved", "failed_at" DESC);

-- Chain verification results table
CREATE TABLE "audit_chain_verification" (
    "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "verified_at" DATETIME NOT NULL DEFAULT (datetime('now', 'utc')),
    "range_start" DATETIME NOT NULL,
    "range_end" DATETIME NOT NULL,
    "total_entries" INTEGER NOT NULL,
    "verified_entries" INTEGER NOT NULL,
    "first_failure_id" TEXT,
    "first_failure_ts" DATETIME,
    "status" TEXT NOT NULL CHECK ("status" IN ('valid', 'invalid', 'partial')),
    "details" TEXT -- JSON with failure information
);

CREATE INDEX "idx_audit_verification_ts" ON "audit_chain_verification"("verified_at" DESC);
CREATE INDEX "idx_audit_verification_status" ON "audit_chain_verification"("status", "verified_at" DESC);
