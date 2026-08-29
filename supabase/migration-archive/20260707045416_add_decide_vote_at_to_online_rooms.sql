-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707045416
-- Original name: add_decide_vote_at_to_online_rooms

ALTER TABLE public.online_rooms ADD COLUMN decide_vote_at TIMESTAMPTZ;
