-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260707045952
-- Original name: add_matchmaking_join_queue_rpc_for_clock_consistency

-- matchmaking/join/route.ts previously wrote joined_at/last_seen_at using the
-- Next.js app-server clock (new Date().toISOString()), while
-- matchmaking_claim_match's ghost-cleanup and opponent-recency checks compare
-- against Postgres NOW(). If the app server's clock is behind the DB's by
-- more than the 30s ghost-sweep window (or 15s recency window), a brand-new
-- queue row can look already-stale to the DB the instant it's inserted,
-- before the first heartbeat ever lands — matching matchmaking_heartbeat's
-- SQL-side NOW() pattern removes the app clock from the equation entirely.
CREATE OR REPLACE FUNCTION public.matchmaking_join_queue(
  p_player_id UUID,
  p_rating INT,
  p_format TEXT,
  p_best_of INT,
  p_double_out BOOLEAN
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO matchmaking_queue (player_id, rating_points, format, best_of, double_out, status, room_id, joined_at, last_seen_at)
  VALUES (p_player_id, p_rating, p_format, p_best_of, p_double_out, 'searching', NULL, NOW(), NOW())
  ON CONFLICT (player_id) DO UPDATE SET
    rating_points = EXCLUDED.rating_points,
    format = EXCLUDED.format,
    best_of = EXCLUDED.best_of,
    double_out = EXCLUDED.double_out,
    status = 'searching',
    room_id = NULL,
    joined_at = NOW(),
    last_seen_at = NOW();
$$;

-- Зөвхөн service_role дуудна (matchmaking_claim_match дээрх тайлбарыг үз).
REVOKE EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) TO service_role;
