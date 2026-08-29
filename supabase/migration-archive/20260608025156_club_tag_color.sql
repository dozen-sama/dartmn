-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260608025156
-- Original name: club_tag_color

alter table public.clubs add column if not exists tag_color text;
alter table public.profiles add column if not exists primary_club_tag_color text;
