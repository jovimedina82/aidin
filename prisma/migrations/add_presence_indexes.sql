-- Optional performance indexes for presence system
-- Run this after the main migration if needed for production optimization

-- Add indexes for foreign key lookups (if not already created by Prisma)
CREATE INDEX IF NOT EXISTS "staff_presence_status_id_idx" ON "staff_presence"("status_id");
CREATE INDEX IF NOT EXISTS "staff_presence_office_location_id_idx" ON "staff_presence"("office_location_id");

-- Add GiST index for efficient tsrange overlap detection
-- This is useful for future optimizations and database-level overlap checking
-- Note: Requires PostgreSQL with btree_gist extension
-- Enable extension if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CREATE INDEX IF NOT EXISTS "staff_presence_user_tsrange_idx"
--   ON "staff_presence"
--   USING gist (user_id, tsrange(start_at, end_at));

-- Note: The GiST index is commented out because:
-- 1. Current validation is done at application layer (lib/presence/validation.ts)
-- 2. The planDay function uses delete-then-recreate pattern which prevents overlaps
-- 3. Enabling this requires the btree_gist extension
-- Uncomment if you want database-level overlap checking in the future

-- Add partial indexes for active status and office lookups
CREATE INDEX IF NOT EXISTS "presence_status_types_active_idx"
  ON "presence_status_types"("isActive")
  WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS "presence_office_locations_active_idx"
  ON "presence_office_locations"("isActive")
  WHERE "isActive" = true;
