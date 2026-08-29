-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606051451
-- Original name: add_tournament_missing_settings


ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS double_out boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS double_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bull_finish_at_limit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_draw boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS third_place_match boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS groups_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS group_advance integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS players_per_group integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS rr_first_to integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rr_sets_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rr_legs_per_set integer NOT NULL DEFAULT 3;
