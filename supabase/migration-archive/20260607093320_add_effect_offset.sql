-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607093320
-- Original name: add_effect_offset

alter table public.cosmetic_effects add column if not exists offset_x numeric not null default 0;
alter table public.cosmetic_effects add column if not exists offset_y numeric not null default 0;
