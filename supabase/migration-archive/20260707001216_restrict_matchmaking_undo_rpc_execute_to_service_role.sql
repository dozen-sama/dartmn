-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707001216
-- Original name: restrict_matchmaking_undo_rpc_execute_to_service_role

REVOKE EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) TO service_role;
