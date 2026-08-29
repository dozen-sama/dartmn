-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607050706
-- Original name: add_name_animated

alter table public.profiles add column if not exists name_animated boolean not null default true;
alter table public.clubs add column if not exists name_animated boolean not null default true;
