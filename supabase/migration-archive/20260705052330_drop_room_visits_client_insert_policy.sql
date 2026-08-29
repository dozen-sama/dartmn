-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705052330
-- Original name: drop_room_visits_client_insert_policy

DROP POLICY IF EXISTS "Players insert own visit" ON public.room_visits;
