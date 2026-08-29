-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607045210
-- Original name: add_nameplate_customization

alter table public.profiles add column if not exists name_color text;
alter table public.profiles add column if not exists name_font text;
alter table public.clubs add column if not exists name_color text;
alter table public.clubs add column if not exists name_font text;
