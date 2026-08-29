-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260601085357
-- Original name: create_tournaments_table


CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_player_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Тэмцээн',
  type TEXT NOT NULL DEFAULT 'league',
  game_mode TEXT NOT NULL DEFAULT 'n01',
  game_settings JSONB NOT NULL DEFAULT '{}',
  legs_per_match INTEGER NOT NULL DEFAULT 1,
  players JSONB NOT NULL DEFAULT '[]',
  matches JSONB NOT NULL DEFAULT '[]',
  standings JSONB NOT NULL DEFAULT '[]',
  rounds JSONB NOT NULL DEFAULT '[]',
  groups JSONB,
  status TEXT NOT NULL DEFAULT 'setup',
  champion_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "t_read" ON tournaments FOR SELECT USING (true);
CREATE POLICY "t_insert" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "t_update" ON tournaments FOR UPDATE USING (true);
