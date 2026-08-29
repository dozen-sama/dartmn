-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260701055548
-- Original name: online_rooms_add_legs_per_set

alter table public.online_rooms add column legs_per_set smallint;
