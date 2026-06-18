-- ============================================================
-- Online rooms: team support (1v1/2v2/3v3) + ready-up + realtime play
-- Safe to re-run (IF NOT EXISTS / guarded).
-- Apply on live DB via Supabase SQL editor (or MCP).
-- ============================================================

-- 1) Extend online_rooms ------------------------------------------------------
ALTER TABLE public.online_rooms
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT '1v1'
    CHECK (mode IN ('1v1', '2v2', '3v3')),
  ADD COLUMN IF NOT EXISTS double_out BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS starter_team SMALLINT,
  ADD COLUMN IF NOT EXISTS winner_team SMALLINT,
  -- Online тэмцээний bracket match-тай холбоос (tournament_matches; Phase 1)
  ADD COLUMN IF NOT EXISTS tournament_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL;

-- 2) room_players: every participant (incl. host), team + slot + ready --------
CREATE TABLE IF NOT EXISTS public.room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.online_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team SMALLINT NOT NULL,
  slot SMALLINT NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, player_id),
  UNIQUE (room_id, team, slot)
);
CREATE INDEX IF NOT EXISTS room_players_room_idx ON public.room_players (room_id);

ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Room players viewable by everyone" ON public.room_players FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users join themselves" ON public.room_players FOR INSERT WITH CHECK (auth.uid() = player_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Players update own ready" ON public.room_players FOR UPDATE USING (auth.uid() = player_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Player or host removes player" ON public.room_players FOR DELETE USING (
    auth.uid() = player_id
    OR auth.uid() = (SELECT host_id FROM public.online_rooms r WHERE r.id = room_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) room_invites: host invites specific @users to a team/slot ----------------
CREATE TABLE IF NOT EXISTS public.room_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.online_rooms(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team SMALLINT NOT NULL,
  slot SMALLINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, invitee_id)
);
CREATE INDEX IF NOT EXISTS room_invites_invitee_idx ON public.room_invites (invitee_id);

ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Invites viewable by everyone" ON public.room_invites FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Inviter creates invite" ON public.room_invites FOR INSERT WITH CHECK (auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Invitee responds" ON public.room_invites FOR UPDATE USING (auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) room_visits: event-sourced live scoreboard (points + darts + who) --------
CREATE TABLE IF NOT EXISTS public.room_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.online_rooms(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  team SMALLINT NOT NULL,
  slot SMALLINT NOT NULL,
  points INTEGER NOT NULL,
  darts SMALLINT NOT NULL DEFAULT 3,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, seq)
);
CREATE INDEX IF NOT EXISTS room_visits_room_idx ON public.room_visits (room_id, seq);

ALTER TABLE public.room_visits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Visits viewable by everyone" ON public.room_visits FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Players insert own visit" ON public.room_visits FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Realtime publication -----------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_visits;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
