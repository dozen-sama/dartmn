-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705053025
-- Original name: drop_room_players_client_write_policies

DROP POLICY IF EXISTS "Users join themselves" ON public.room_players;
DROP POLICY IF EXISTS "Players update own ready" ON public.room_players;
