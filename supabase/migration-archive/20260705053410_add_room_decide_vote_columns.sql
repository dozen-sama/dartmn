-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705053410
-- Original name: add_room_decide_vote_columns

ALTER TABLE public.online_rooms
  ADD COLUMN decide_vote_team SMALLINT,
  ADD COLUMN decide_vote_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
