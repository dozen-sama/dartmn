-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260623140415
-- Original name: add_platform_fee_paid_to_tournaments

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS platform_fee_paid boolean NOT NULL DEFAULT false;
