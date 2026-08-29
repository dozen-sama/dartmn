-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705054449
-- Original name: add_online_rooms_loser_first

ALTER TABLE public.online_rooms ADD COLUMN loser_first BOOLEAN NOT NULL DEFAULT false;
