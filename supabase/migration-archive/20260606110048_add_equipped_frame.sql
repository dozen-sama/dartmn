-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606110048
-- Original name: add_equipped_frame

alter table public.profiles add column if not exists equipped_frame text;
alter table public.clubs add column if not exists equipped_frame text;
