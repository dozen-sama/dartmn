-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260609090520
-- Original name: drop_dead_checkout_accumulators

alter table public.profiles
  drop column if exists checkout_hits,
  drop column if exists checkout_attempts;
