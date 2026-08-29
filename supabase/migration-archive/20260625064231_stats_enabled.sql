-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260625064231
-- Original name: stats_enabled

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS stats_enabled boolean NOT NULL DEFAULT false;
