-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705052645
-- Original name: drop_online_rooms_guest_update_policy

DROP POLICY IF EXISTS "Guests can join rooms" ON public.online_rooms;
