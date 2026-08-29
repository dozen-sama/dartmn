-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705113212
-- Original name: matchmaking_atomic_claim_match

CREATE OR REPLACE FUNCTION public.matchmaking_claim_match(
  p_player_id UUID,
  p_rating INT,
  p_format TEXT,
  p_best_of INT,
  p_double_out BOOLEAN,
  p_elo_window INT
)
RETURNS TABLE(room_id UUID, matched BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self RECORD;
  v_opponent RECORD;
  v_room_id UUID;
  v_code TEXT;
  i INT;
BEGIN
  -- Lock own queue row first: a concurrent duplicate call for the same
  -- player_id (double-click, retry) must serialize here, not race below.
  SELECT * INTO v_self FROM matchmaking_queue WHERE player_id = p_player_id FOR UPDATE;

  IF v_self.id IS NULL OR v_self.status <> 'searching' THEN
    RETURN QUERY SELECT v_self.room_id, COALESCE(v_self.status = 'matched', false);
    RETURN;
  END IF;

  -- FOR UPDATE SKIP LOCKED: if another concurrent caller is already
  -- evaluating this same candidate, skip it instead of double-claiming it.
  SELECT * INTO v_opponent
  FROM matchmaking_queue
  WHERE status = 'searching'
    AND player_id <> p_player_id
    AND format = p_format
    AND best_of = p_best_of
    AND double_out = p_double_out
    AND rating_points BETWEEN p_rating - p_elo_window AND p_rating + p_elo_window
  ORDER BY joined_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_opponent.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false;
    RETURN;
  END IF;

  FOR i IN 1..5 LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO online_rooms (room_code, host_id, format, best_of, mode, double_out, limit_rounds, bull_finish, start_method, status)
      VALUES (v_code, v_opponent.player_id, p_format, p_best_of, '1v1', p_double_out, NULL, false, 'random', 'waiting')
      RETURNING id INTO v_room_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_room_id := NULL;
    END;
  END LOOP;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'matchmaking: room code collision retries exhausted';
  END IF;

  INSERT INTO room_players (room_id, player_id, team, slot, is_ready)
  VALUES (v_room_id, v_opponent.player_id, 0, 0, false),
         (v_room_id, p_player_id, 1, 0, false);

  UPDATE matchmaking_queue
  SET status = 'matched', room_id = v_room_id
  WHERE player_id IN (p_player_id, v_opponent.player_id);

  RETURN QUERY SELECT v_room_id, true;
END;
$$;
