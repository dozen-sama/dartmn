-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260601083156
-- Original name: create_rooms_table


-- Create rooms table for online multiplayer
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) NOT NULL UNIQUE,
  host_player_id TEXT NOT NULL,
  game_mode TEXT NOT NULL DEFAULT 'n01',
  game_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_state JSONB DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on code for fast lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms (code);

-- Index on status for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms (status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read rooms (needed to join by code)
CREATE POLICY "Anyone can read rooms"
  ON public.rooms
  FOR SELECT
  USING (true);

-- Allow anyone to create a room (anon users)
CREATE POLICY "Anyone can create a room"
  ON public.rooms
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update a room (players can update game state)
CREATE POLICY "Anyone can update a room"
  ON public.rooms
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
