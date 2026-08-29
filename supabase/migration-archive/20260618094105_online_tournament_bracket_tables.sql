-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618094105
-- Original name: online_tournament_bracket_tables

-- ============================================================
-- Online тэмцээн: bracket persistence (Phase 1)
-- entrant = bracket-ийн нэгж (singles → 1 тоглогч, doubles/team → N тоглогч)
-- Бичилт зөвхөн service-role (RPC); SELECT нийтэд нээлттэй.
-- ============================================================

-- 1) tournament_entrants -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_entrants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  seed INTEGER NOT NULL,
  group_no INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tournament_entrants_tournament_idx ON public.tournament_entrants (tournament_id);
ALTER TABLE public.tournament_entrants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Entrants viewable by everyone" ON public.tournament_entrants FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) tournament_entrant_players ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_entrant_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entrant_id UUID NOT NULL REFERENCES public.tournament_entrants(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (entrant_id, slot),
  UNIQUE (entrant_id, player_id)
);
CREATE INDEX IF NOT EXISTS tournament_entrant_players_entrant_idx ON public.tournament_entrant_players (entrant_id);
CREATE INDEX IF NOT EXISTS tournament_entrant_players_player_idx ON public.tournament_entrant_players (player_id);
ALTER TABLE public.tournament_entrant_players ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Entrant players viewable by everyone" ON public.tournament_entrant_players FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) tournament_matches (LocalMatch-ийн DB хувилбар) ------------------------
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  is_losers_bracket BOOLEAN NOT NULL DEFAULT false,
  group_no INTEGER,
  side1_entrant_id UUID REFERENCES public.tournament_entrants(id) ON DELETE SET NULL,
  side2_entrant_id UUID REFERENCES public.tournament_entrants(id) ON DELETE SET NULL,
  side1_legs INTEGER NOT NULL DEFAULT 0,
  side2_legs INTEGER NOT NULL DEFAULT 0,
  winner_entrant_id UUID REFERENCES public.tournament_entrants(id) ON DELETE SET NULL,
  loser_entrant_id UUID REFERENCES public.tournament_entrants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'completed')),
  next_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  next_loser_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.online_rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tournament_matches_tournament_idx ON public.tournament_matches (tournament_id, round, match_number);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tournament matches viewable by everyone" ON public.tournament_matches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) online_rooms → tournament_match холбоос --------------------------------
ALTER TABLE public.online_rooms
  ADD COLUMN IF NOT EXISTS tournament_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL;

-- 5) Realtime publication (live bracket) ------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_entrants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
