-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707034559
-- Original name: drop_online_rooms_host_manage_policy

DROP POLICY IF EXISTS "Hosts can manage their rooms" ON public.online_rooms;
