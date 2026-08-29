-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260617032618
-- Original name: room_visits_replica_identity_full

-- DELETE realtime event-д бүх багана (room_id, seq) орохын тулд (undo синк)
ALTER TABLE public.room_visits REPLICA IDENTITY FULL;
