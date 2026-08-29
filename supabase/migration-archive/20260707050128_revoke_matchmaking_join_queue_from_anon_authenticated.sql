-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707050128
-- Original name: revoke_matchmaking_join_queue_from_anon_authenticated

-- CREATE FUNCTION-ий үед энэ project-д ALTER DEFAULT PRIVILEGES-ээр anon/authenticated
-- рольд автоматаар EXECUTE олгогддог тул зөвхөн "REVOKE ... FROM PUBLIC" хангалтгүй байв
-- (matchmaking_heartbeat/matchmaking_claim_match-тай адилтгав).
REVOKE EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) FROM anon, authenticated;
