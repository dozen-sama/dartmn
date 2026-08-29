-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260624094006
-- Original name: create_matchmaking_queue


CREATE TABLE matchmaking_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_points INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT '501',
  best_of INTEGER NOT NULL DEFAULT 3,
  double_out BOOLEAN NOT NULL DEFAULT true,
  room_id UUID REFERENCES online_rooms(id),
  status TEXT NOT NULL DEFAULT 'searching',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matchmaking_queue_player_id_unique UNIQUE(player_id)
);

CREATE INDEX idx_matchmaking_queue_searching
  ON matchmaking_queue(status, rating_points, joined_at)
  WHERE status = 'searching';

ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own entry" ON matchmaking_queue
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "insert own entry" ON matchmaking_queue
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "update own entry" ON matchmaking_queue
  FOR UPDATE USING (player_id = auth.uid());

CREATE POLICY "delete own entry" ON matchmaking_queue
  FOR DELETE USING (player_id = auth.uid());
