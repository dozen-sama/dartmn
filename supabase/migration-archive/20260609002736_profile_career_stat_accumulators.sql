-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260609002736
-- Original name: profile_career_stat_accumulators

alter table public.profiles
  add column if not exists career_points integer not null default 0,
  add column if not exists career_darts integer not null default 0,
  add column if not exists checkout_hits integer not null default 0,
  add column if not exists checkout_attempts integer not null default 0;
