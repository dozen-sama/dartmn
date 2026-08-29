-- ============================================================
-- DartMN Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  cover_url TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  city TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'club_admin', 'admin')),
  rating_points INTEGER NOT NULL DEFAULT 1000,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  tournament_wins INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  checkout_percentage NUMERIC(5,4) NOT NULL DEFAULT 0,
  highest_checkout INTEGER NOT NULL DEFAULT 0,
  count_180 INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX profiles_username_idx ON public.profiles USING btree (username);
CREATE INDEX profiles_rating_idx ON public.profiles USING btree (rating_points DESC);
CREATE INDEX profiles_username_trgm_idx ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX profiles_display_name_trgm_idx ON public.profiles USING gin (display_name gin_trgm_ops);

-- ============================================================
-- CLUBS
-- ============================================================
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL DEFAULT 1,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clubs are viewable by everyone" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Club owners can update" ON public.clubs FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Authenticated users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Club owners can delete" ON public.clubs FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX clubs_owner_idx ON public.clubs USING btree (owner_id);
CREATE INDEX clubs_member_count_idx ON public.clubs USING btree (member_count DESC);

-- ============================================================
-- CLUB MEMBERS
-- ============================================================
CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, player_id)
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members viewable by everyone" ON public.club_members FOR SELECT USING (true);
CREATE POLICY "Club admins can manage members" ON public.club_members FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_members.club_id
      AND cm.player_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Users can join clubs" ON public.club_members FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can leave clubs" ON public.club_members FOR DELETE USING (auth.uid() = player_id);

CREATE INDEX club_members_club_idx ON public.club_members USING btree (club_id);
CREATE INDEX club_members_player_idx ON public.club_members USING btree (player_id);

-- Update club member_count on insert/delete
CREATE OR REPLACE FUNCTION public.update_club_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER club_members_count_trigger
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();

-- ============================================================
-- TOURNAMENTS
-- ============================================================
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('501', '301')),
  type TEXT NOT NULL DEFAULT 'singles' CHECK (type IN ('singles', 'doubles', 'team')),
  bracket_type TEXT NOT NULL DEFAULT 'single_elimination'
    CHECK (bracket_type IN ('single_elimination', 'double_elimination', 'round_robin', 'groups_knockout', 'swiss')),
  -- groups_knockout: бүлгийн тоо ба бүлэг бүрээс шигшээ (KO)-д дэвших байр
  groups_count INTEGER NOT NULL DEFAULT 1,
  group_advance INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'registration', 'ongoing', 'completed', 'cancelled')),
  max_players INTEGER NOT NULL DEFAULT 16,
  current_players INTEGER NOT NULL DEFAULT 0,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  location TEXT,
  banner_url TEXT,
  rules TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Organizers can manage tournaments" ON public.tournaments FOR ALL USING (auth.uid() = organizer_id);
CREATE POLICY "Authenticated users can create tournaments" ON public.tournaments FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE TRIGGER tournaments_updated_at BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX tournaments_status_idx ON public.tournaments USING btree (status);
CREATE INDEX tournaments_start_date_idx ON public.tournaments USING btree (start_date DESC);
CREATE INDEX tournaments_organizer_idx ON public.tournaments USING btree (organizer_id);

-- ============================================================
-- TOURNAMENT REGISTRATIONS
-- ============================================================
CREATE TABLE public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed INTEGER,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_id UUID,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, player_id)
);

ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registrations viewable by everyone" ON public.tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Users can register themselves" ON public.tournament_registrations FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Users can unregister themselves" ON public.tournament_registrations FOR DELETE USING (auth.uid() = player_id);
CREATE POLICY "Organizers can update registrations" ON public.tournament_registrations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.organizer_id = auth.uid())
);

-- Update tournament current_players on register/unregister
CREATE OR REPLACE FUNCTION public.update_tournament_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournaments SET current_players = current_players + 1 WHERE id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournaments SET current_players = GREATEST(current_players - 1, 0) WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tournament_registration_count_trigger
  AFTER INSERT OR DELETE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_tournament_player_count();

CREATE INDEX registrations_tournament_idx ON public.tournament_registrations USING btree (tournament_id);
CREATE INDEX registrations_player_idx ON public.tournament_registrations USING btree (player_id);

-- ============================================================
-- ONLINE TOURNAMENT BRACKET (entrants + matches)
-- entrant = bracket-ийн нэгж (singles → 1 тоглогч, doubles/team → N тоглогч).
-- Бичилт зөвхөн service-role (RPC); SELECT нийтэд нээлттэй. Realtime-д орсон.
-- ============================================================
CREATE TABLE public.tournament_entrants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  seed INTEGER NOT NULL,
  group_no INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tournament_entrants_tournament_idx ON public.tournament_entrants (tournament_id);
ALTER TABLE public.tournament_entrants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entrants viewable by everyone" ON public.tournament_entrants FOR SELECT USING (true);

CREATE TABLE public.tournament_entrant_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entrant_id UUID NOT NULL REFERENCES public.tournament_entrants(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (entrant_id, slot),
  UNIQUE (entrant_id, player_id)
);
CREATE INDEX tournament_entrant_players_entrant_idx ON public.tournament_entrant_players (entrant_id);
CREATE INDEX tournament_entrant_players_player_idx ON public.tournament_entrant_players (player_id);
ALTER TABLE public.tournament_entrant_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entrant players viewable by everyone" ON public.tournament_entrant_players FOR SELECT USING (true);

-- bracket-ийн match (LocalMatch-ийн DB хувилбар, src/lib/local-game/bracket.ts)
CREATE TABLE public.tournament_matches (
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
CREATE INDEX tournament_matches_tournament_idx ON public.tournament_matches (tournament_id, round, match_number);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournament matches viewable by everyone" ON public.tournament_matches FOR SELECT USING (true);
-- online_rooms.tournament_match_id багана нь online_rooms_teams.sql-д ALTER-аар нэмэгдэнэ.

-- self-FK-ууд (next_match_id/next_loser_match_id) нэг INSERT дотор хожуу round заадаг
-- тул DEFERRABLE — шалгалт транзакцийн төгсгөлд.
ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_next_match_id_fkey,
  DROP CONSTRAINT IF EXISTS tournament_matches_next_loser_match_id_fkey;
ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_next_match_id_fkey
    FOREIGN KEY (next_match_id) REFERENCES public.tournament_matches(id)
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT tournament_matches_next_loser_match_id_fkey
    FOREIGN KEY (next_loser_match_id) REFERENCES public.tournament_matches(id)
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- start_tournament: TS (bracket-server.ts)-д бэлдсэн entrant/match-уудыг нэг
-- транзакцид хийж status → ongoing. advance_tournament_match: match дуусгаж
-- ялагчийг дараагийн match руу (DE-д ялагдагчийг next_loser_match_id руу) дэвшүүлнэ
-- (claim-first). Дуусгах нөхцөл bracket-аас хамаарна: round_robin → бүх match
-- дуусахад; swiss → авто-дуусахгүй (зохион байгуулагч /finish-ээр дуусгана);
-- SE/DE/groups → winners/их финал (next_match_id null, losers бус, group_no null) дуусахад.
-- Тодорхойлолт: supabase migration-уудад (tournament_start_advance_rpcs,
-- advance_tournament_match_rr_completion, advance_tournament_match_groups_completion,
-- advance_tournament_match_swiss_no_autocomplete).
-- seed_knockout(p_tournament_id, p_assignments): groups_knockout-д бүлгийн шат
-- дуусахад /advance-knockout route нь хүснэгтээс дээгүүр N-ийг (TS cross-seed)
-- KO round-1-ийн хоосон талуудад атомикоор суулгана (migration: seed_knockout_rpc).
-- Swiss дараагийн тойрог (/next-round) ба DE bracket-ийг тус тус /next-round route +
-- buildDoubleEliminationRows (bracket-server.ts) дотор боддог (RPC бус, admin insert).

-- ============================================================
-- OFF-PLATFORM САНХҮҮ + ЗОХИОН БАЙГУУЛАГЧИЙН ҮНЭЛГЭЭ (Phase 3)
-- ============================================================
-- tournaments дээр зохион байгуулагчийн бооцоо хүлээн авах данс (public — оролцогчдод):
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS organizer_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS organizer_iban TEXT,
  ADD COLUMN IF NOT EXISTS organizer_account_number TEXT,
  ADD COLUMN IF NOT EXISTS organizer_account_holder TEXT;

-- Оролцогчийн шагнал хүлээн авах данс — НУУЦ (зөвхөн өөрөө + зохион байгуулагч уншина)
CREATE TABLE public.tournament_payout_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  iban TEXT,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id)
);
CREATE INDEX payout_accounts_tournament_idx ON public.tournament_payout_accounts (tournament_id);
ALTER TABLE public.tournament_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payout account: self or organizer reads" ON public.tournament_payout_accounts FOR SELECT USING (
  auth.uid() = player_id OR auth.uid() = (SELECT organizer_id FROM public.tournaments t WHERE t.id = tournament_id));
CREATE POLICY "Payout account: self inserts" ON public.tournament_payout_accounts FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Payout account: self updates" ON public.tournament_payout_accounts FOR UPDATE USING (auth.uid() = player_id);

-- Зохион байгуулагчийн үнэлгээ (1=гомдол ... 5=сайшаал), тэмцээн дуусахад тоглогч өгнө
CREATE TABLE public.organizer_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  payout_status TEXT CHECK (payout_status IN ('paid', 'unpaid')), -- шагнал төлсөн эсэх (NULL = хожоогүй/хамаарахгүй)
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, rater_id),
  CHECK (rater_id <> organizer_id)
);
CREATE INDEX organizer_ratings_organizer_idx ON public.organizer_ratings (organizer_id);
ALTER TABLE public.organizer_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings viewable by everyone" ON public.organizer_ratings FOR SELECT USING (true);
-- Зөвхөн тухайн тэмцээнд бүртгэгдсэн оролцогч үнэлгээ өгнө (хуурамч хаягнаас хамгаална)
CREATE POLICY "Rater inserts own rating" ON public.organizer_ratings FOR INSERT WITH CHECK (
  auth.uid() = rater_id AND EXISTS (
    SELECT 1 FROM public.tournament_registrations r
    WHERE r.tournament_id = organizer_ratings.tournament_id AND r.player_id = auth.uid()));
CREATE POLICY "Rater updates own rating" ON public.organizer_ratings FOR UPDATE USING (auth.uid() = rater_id);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  league_id UUID,
  round INTEGER,
  match_number INTEGER,
  player1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('501', '301')),
  best_of INTEGER NOT NULL DEFAULT 3,
  player1_legs INTEGER NOT NULL DEFAULT 0,
  player2_legs INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Players can update their own matches" ON public.matches FOR UPDATE USING (
  auth.uid() IN (player1_id, player2_id)
);
CREATE POLICY "Authenticated users can create matches" ON public.matches FOR INSERT WITH CHECK (
  auth.uid() = player1_id
);

CREATE INDEX matches_tournament_idx ON public.matches USING btree (tournament_id);
CREATE INDEX matches_player1_idx ON public.matches USING btree (player1_id);
CREATE INDEX matches_player2_idx ON public.matches USING btree (player2_id);
CREATE INDEX matches_status_idx ON public.matches USING btree (status);

-- ============================================================
-- MATCH LEGS
-- ============================================================
CREATE TABLE public.match_legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL,
  player1_score INTEGER NOT NULL DEFAULT 0,
  player2_score INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player1_darts INTEGER NOT NULL DEFAULT 0,
  player2_darts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.match_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match legs viewable by everyone" ON public.match_legs FOR SELECT USING (true);
CREATE POLICY "Match players can insert legs" ON public.match_legs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND auth.uid() IN (m.player1_id, m.player2_id)
  )
);

CREATE INDEX match_legs_match_idx ON public.match_legs USING btree (match_id);

-- ============================================================
-- THROWS (individual dart throws)
-- ============================================================
CREATE TABLE public.throws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leg_id UUID NOT NULL REFERENCES public.match_legs(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  throw_number INTEGER NOT NULL,
  score INTEGER NOT NULL,
  darts_used INTEGER NOT NULL DEFAULT 3,
  remaining INTEGER NOT NULL,
  is_checkout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.throws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Throws viewable by everyone" ON public.throws FOR SELECT USING (true);
CREATE POLICY "Players can insert their own throws" ON public.throws FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE INDEX throws_leg_idx ON public.throws USING btree (leg_id);
CREATE INDEX throws_player_idx ON public.throws USING btree (player_id);

-- ============================================================
-- LEAGUES
-- ============================================================
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  season TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('501', '301')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  max_teams INTEGER NOT NULL DEFAULT 16,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues viewable by everyone" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "League creators can manage" ON public.leagues FOR ALL USING (auth.uid() = created_by);

CREATE INDEX leagues_status_idx ON public.leagues USING btree (status);

-- ============================================================
-- LEAGUE STANDINGS
-- ============================================================
CREATE TABLE public.league_standings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  legs_won INTEGER NOT NULL DEFAULT 0,
  legs_lost INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Standings viewable by everyone" ON public.league_standings FOR SELECT USING (true);

CREATE INDEX standings_league_idx ON public.league_standings USING btree (league_id, points DESC);

-- ============================================================
-- RATING HISTORY
-- ============================================================
CREATE TABLE public.rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  change INTEGER NOT NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.online_rooms(id) ON DELETE SET NULL,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  won BOOLEAN,
  reason TEXT NOT NULL DEFAULT 'match',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rating history viewable by everyone" ON public.rating_history FOR SELECT USING (true);

CREATE INDEX rating_history_player_idx ON public.rating_history USING btree (player_id, created_at DESC);

-- Тоглолтын үр дүнг нэг транзакцид хэрэглэнэ: бүх тоглогчийн профайл + rating_history +
-- achievements. Дунд нь унавал бүгд rollback (хагас sync гарахгүй). ELO/статистикийг
-- дуудагч (src/lib/local-game/match-stats.ts) урьдчилан тооцоолж дамжуулна.
CREATE OR REPLACE FUNCTION public.apply_match_result(p_updates jsonb, p_history jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u jsonb;
BEGIN
  FOR u IN SELECT value FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb)) LOOP
    UPDATE public.profiles SET
      rating_points    = (u->>'rating_points')::int,
      matches_played   = (u->>'matches_played')::int,
      matches_won      = (u->>'matches_won')::int,
      count_180        = (u->>'count_180')::int,
      highest_checkout = (u->>'highest_checkout')::int,
      average_score    = (u->>'average_score')::numeric,
      career_points    = (u->>'career_points')::int,
      career_darts     = (u->>'career_darts')::int
    WHERE id = (u->>'id')::uuid;
  END LOOP;

  IF COALESCE(jsonb_array_length(p_history), 0) > 0 THEN
    INSERT INTO public.rating_history
      (player_id, rating_before, rating_after, change, reason, opponent_id, won, room_id)
    SELECT (h->>'player_id')::uuid, (h->>'rating_before')::int, (h->>'rating_after')::int,
           (h->>'change')::int, h->>'reason', NULLIF(h->>'opponent_id','')::uuid,
           (h->>'won')::boolean, NULLIF(h->>'room_id','')::uuid
    FROM jsonb_array_elements(p_history) h;
  END IF;

  FOR u IN SELECT value FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb)) LOOP
    PERFORM public.check_achievements((u->>'id')::uuid);
  END LOOP;
END;
$$;

-- ============================================================
-- PAYMENT TRANSACTIONS
-- ============================================================
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MNT',
  provider TEXT NOT NULL CHECK (provider IN ('qpay', 'socialpay')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  invoice_id TEXT,
  qr_text TEXT,
  deep_link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- subscriptions/activate route-д replay хамгаалалт: conditional UPDATE
  -- (WHERE consumed_at IS NULL) ашиглан гүйлгээ бүрийг зөвхөн нэг л удаа ашиглана.
  consumed_at TIMESTAMPTZ
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Users can create their own transactions" ON public.payment_transactions FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX payments_player_idx ON public.payment_transactions USING btree (player_id);
CREATE INDEX payments_tournament_idx ON public.payment_transactions USING btree (tournament_id);

-- ============================================================
-- ONLINE ROOMS (real-time match rooms)
-- ============================================================
CREATE TABLE public.online_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('501', '301', '170')),
  best_of INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'bulloff', 'ongoing', 'completed')),
  mode TEXT NOT NULL DEFAULT '1v1' CHECK (mode IN ('1v1', '2v2', '3v3')),
  double_out BOOLEAN NOT NULL DEFAULT true,
  limit_rounds SMALLINT,
  bull_finish BOOLEAN NOT NULL DEFAULT false,
  loser_first BOOLEAN NOT NULL DEFAULT false,
  start_method TEXT NOT NULL DEFAULT 'random' CHECK (start_method IN ('random', 'bulloff')),
  starter_team SMALLINT,
  winner_team SMALLINT,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Bull-finish decide: эсрэг талын баталгаажуулалт хүлээж буй санал (decide/route.ts)
  decide_vote_team SMALLINT,
  decide_vote_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Санал хэзээ илгээгдснийг тэмдэглэнэ — эсрэг тал холбогдохгүй (tab хаасан) үед
  -- IDLE хугацаа өнгөрсний дараа саналыг илгээгч тал timeout-оор өөрөө баталгаажуулж болно
  decide_vote_at TIMESTAMPTZ
);

ALTER TABLE public.online_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Waiting rooms viewable by everyone" ON public.online_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.online_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
-- "Guests can join rooms" UPDATE policy устгасан (2026-07-05): guest_id багана апп-д хэзээ ч бичигддэггүй хоцрогдсон
-- багана байсан бөгөөд WITH CHECK байхгүй тул дурын хэрэглэгч waiting room-ийн host_id/format/mode зэргийг
-- чөлөөтэй өөрчилж чаддаг байв. Тоглогч нэгдэх нь одоо /api/play/room/[id]/join (service-role) route-оор
-- room_players-д бичигдэнэ, тул client UPDATE policy огт хэрэггүй.
-- "Hosts can manage their rooms" FOR ALL policy устгасан (2026-07-07): WITH CHECK-гүй тул host client-аас
-- decide_vote_team/decide_vote_by/winner_team/status зэргийг шууд бичиж, mutual-confirmation "decide" route-ийг
-- тойрч болдог байв. Бүх UPDATE/DELETE аль хэдийн зөвхөн service-role admin client-аар route.ts-үүдээс
-- хийгддэг (client-ээс шууд .update()/.delete() дуудагддаггүй) тул энэ policy огт хэрэггүй байсан.

CREATE INDEX online_rooms_status_idx ON public.online_rooms USING btree (status);
CREATE INDEX online_rooms_code_idx ON public.online_rooms USING btree (room_code);

-- matchmaking_queue: ELO-гээр ойролцоо тоглогч хайх дараалал
CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_points INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT '501',
  best_of INTEGER NOT NULL DEFAULT 3,
  double_out BOOLEAN NOT NULL DEFAULT true,
  room_id UUID REFERENCES public.online_rooms(id),
  status TEXT NOT NULL DEFAULT 'searching',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Client heartbeat while status='searching' (see matchmaking_heartbeat below).
  -- Lets matchmaking_claim_match tell apart a live search from a ghost entry
  -- left behind by a closed/crashed tab that never called /leave.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own entry" ON public.matchmaking_queue FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "insert own entry" ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "update own entry" ON public.matchmaking_queue FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "delete own entry" ON public.matchmaking_queue FOR DELETE USING (auth.uid() = player_id);

CREATE INDEX idx_matchmaking_queue_searching ON public.matchmaking_queue USING btree (status, rating_points, joined_at) WHERE (status = 'searching');

-- Тоглогч хайх+таарах+өрөө үүсгэхийг НЭГ атомик транзакцад (FOR UPDATE SKIP LOCKED)
-- хийдэг: хоёр тоглогч бараг зэрэг join хийхэд өмнө нь /api/matchmaking/join
-- 2-3 тусдаа round-trip-ээр (select→insert room→insert room_players→update queue)
-- хийдэг байсан тул хоёул нэг оппонентыг зэрэг "барьж", давхар өрөө үүсгэх/нэг
-- тоглогчийг 2 өрөөнд оруулах боломжтой байв.
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
  -- Serialize the whole matching decision across ALL concurrent callers (any
  -- player), not just duplicate calls for the same player_id. Without this,
  -- two players joining at nearly the same moment each lock their own row
  -- first (see below) and then look for each other with FOR UPDATE SKIP
  -- LOCKED — each sees the other's row as locked-by-someone-else and skips
  -- it, so both report "no opponent found" even though they were a perfect
  -- match (livelock). The advisory lock makes claim attempts run one at a
  -- time, so SKIP LOCKED below never has a same-instant competitor to skip.
  PERFORM pg_advisory_xact_lock(hashtext('matchmaking_claim_match'));

  -- Lock own queue row first: a concurrent duplicate call for the same
  -- player_id (double-click, retry) must serialize here, not race below.
  SELECT * INTO v_self FROM matchmaking_queue WHERE player_id = p_player_id FOR UPDATE;

  IF v_self.id IS NULL OR v_self.status <> 'searching' THEN
    RETURN QUERY SELECT v_self.room_id, COALESCE(v_self.status = 'matched', false);
    RETURN;
  END IF;

  -- Self-heal: opportunistically clear out ghost entries (abandoned tabs that
  -- never called /leave) so they stop being offered as opponents to anyone.
  -- SKIP LOCKED so this never blocks on a row another concurrent claim call
  -- is actively evaluating.
  DELETE FROM matchmaking_queue
  WHERE id IN (
    SELECT id FROM matchmaking_queue
    WHERE status = 'searching'
      AND player_id <> p_player_id
      AND last_seen_at < NOW() - INTERVAL '30 seconds'
    FOR UPDATE SKIP LOCKED
  );

  -- FOR UPDATE SKIP LOCKED: if another concurrent caller is already
  -- evaluating this same candidate, skip it instead of double-claiming it.
  -- Only consider opponents seen recently (excludes ghosts whose heartbeat
  -- lapsed but haven't been swept by the DELETE above yet).
  SELECT * INTO v_opponent
  FROM matchmaking_queue
  WHERE status = 'searching'
    AND player_id <> p_player_id
    AND format = p_format
    AND best_of = p_best_of
    AND double_out = p_double_out
    AND rating_points BETWEEN p_rating - p_elo_window AND p_rating + p_elo_window
    AND last_seen_at > NOW() - INTERVAL '15 seconds'
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

-- Зөвхөн service_role (Next.js API route-уудын admin client) дуудна. anon/authenticated-аас
-- шууд дуудвал p_player_id parameter-ээр дурын хэрэглэгчийг олонддог тул PUBLIC-ээс revoke хийсэн —
-- эдгээр SECURITY DEFINER функц дотроо auth.uid()-тэй харьцуулдаггүй (учир нь admin client-ээр
-- дуудахад auth.uid() NULL байдаг), тул зөвхөн грант-аар хязгаарлана.
REVOKE EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaking_claim_match(uuid, integer, text, integer, boolean, integer) TO service_role;

-- Client calls this every few seconds while status='searching' (see
-- /api/matchmaking/heartbeat) to prove the tab is still open. Rows whose
-- last_seen_at goes stale are treated as ghosts by matchmaking_claim_match.
CREATE OR REPLACE FUNCTION public.matchmaking_heartbeat(p_player_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE matchmaking_queue
  SET last_seen_at = NOW()
  WHERE player_id = p_player_id AND status = 'searching';
$$;

-- Зөвхөн service_role дуудна (доод тайлбарыг matchmaking_claim_match дээрээс үз).
REVOKE EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchmaking_heartbeat(uuid) TO service_role;

-- matchmaking/join/route.ts дуудна. joined_at/last_seen_at-г app-серверийн
-- цагаар (new Date()) биш, доторх NOW()-оор бичдэг — matchmaking_claim_match-ийн
-- ghost-cleanup/recency шалгалт мөн NOW()-оор хийдэг тул clock drift-ийн улмаас
-- шинэ мөр анхны heartbeat-ээс өмнө "ghost" гэж алдагдахаас сэргийлнэ.
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

-- Зөвхөн service_role дуудна. "FROM PUBLIC" хангалтгүй байсан — энэ project дээр
-- CREATE FUNCTION-ий үед ALTER DEFAULT PRIVILEGES-ээр anon/authenticated рольд
-- шууд (PUBLIC-аас тусдаа) EXECUTE олгогддог тул тэдгээрийг ч тодорхой REVOKE хийнэ.
REVOKE EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matchmaking_join_queue(uuid, integer, text, integer, boolean) TO service_role;

-- room_players: every participant (incl. host), team + slot + ready
CREATE TABLE public.room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.online_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team SMALLINT NOT NULL,
  slot SMALLINT NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  bulloff SMALLINT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, player_id),
  UNIQUE (room_id, team, slot)
);
CREATE INDEX room_players_room_idx ON public.room_players (room_id);
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room players viewable by everyone" ON public.room_players FOR SELECT USING (true);
-- "Users join themselves" INSERT policy болон "Players update own ready" UPDATE policy устгасан (2026-07-05):
-- room статус шалгаагүй тул client-аар шууд бичихэд идэвхтэй (ongoing) тоглолтод зөвшөөрөлгүй нэгдэх, эсвэл
-- бусад тоглогчийн team/slot-той мөргөлдөх боломжтой байсан. Join/ready/bulloff бүгд одоо
-- /api/play/room/[id]/{join,ready,bulloff} (service-role) route-оор room статус шалгаж бичдэг тул
-- client INSERT/UPDATE policy огт хэрэггүй байсан.
CREATE POLICY "Player or host removes player" ON public.room_players FOR DELETE USING (
  auth.uid() = player_id
  OR auth.uid() = (SELECT host_id FROM public.online_rooms r WHERE r.id = room_id)
);

-- room_invites: host invites specific @users to a team/slot
CREATE TABLE public.room_invites (
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
CREATE INDEX room_invites_invitee_idx ON public.room_invites (invitee_id);
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invites viewable by everyone" ON public.room_invites FOR SELECT USING (true);
CREATE POLICY "Inviter creates invite" ON public.room_invites FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Invitee responds" ON public.room_invites FOR UPDATE USING (auth.uid() = invitee_id);

-- room_visits: event-sourced live scoreboard (points + darts + who threw)
CREATE TABLE public.room_visits (
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
CREATE INDEX room_visits_room_idx ON public.room_visits (room_id, seq);
ALTER TABLE public.room_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visits viewable by everyone" ON public.room_visits FOR SELECT USING (true);
-- Direct client insert intentionally disallowed: only server routes (turn/decide),
-- using the service-role admin client, are permitted to write visits.

-- Undo-г нэг атомик DELETE-ээр гүйцэтгэнэ: "seq-ээс өндөр өөр мөр байхгүй" нөхцөлийг
-- мөрийг устгах statement-ийн дотор шалгадаг тул read (сүүлийн visit)-ээс delete хүртэлх
-- цонхонд өрсөлдөгч шинэ ээлж (visit) нэмчихвэл race-аар буруу (аль хэдийн хуучирсан) мөр
-- устдаггүй (устгах гэж буй мөрөөс seq өндөр мөр гарч ирмэгц WHERE нөхцөл хангахгүй болно).
CREATE OR REPLACE FUNCTION public.undo_last_room_visit(p_room_id UUID, p_user_id UUID)
RETURNS SETOF public.room_visits
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.room_visits rv
  WHERE rv.room_id = p_room_id
    AND rv.created_by = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.room_visits rv2
      WHERE rv2.room_id = rv.room_id AND rv2.seq > rv.seq
    )
  RETURNING rv.*;
$$;

-- Зөвхөн service_role дуудна (доод тайлбарыг matchmaking_claim_match дээрээс үз).
REVOKE EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_last_room_visit(uuid, uuid) TO service_role;

-- ============================================================
-- match_stat_details-ийн нэгтгэсэн статистик (профайл/статистик хуудас)
-- Тоглолтгүй тоглогчид ч бүх sum() талбарууд NULL биш 0 буцаана
-- (зөвхөн best_leg_darts/worst_leg_darts NULL-able хэвээр — MIN/MAX empty).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_player_stat_summary(p_player_id uuid)
 RETURNS TABLE(matches bigint, legs_for bigint, legs_against bigint, darts_thrown bigint, points_scored bigint, avg3 numeric, avg_first9 numeric, band_60 bigint, band_80 bigint, band_100 bigint, band_120 bigint, band_140 bigint, band_170 bigint, count_180 bigint, high_finish integer, count_100_finishes bigint, best_leg_darts integer, worst_leg_darts integer, checkout_attempts bigint, checkout_makes bigint, keep_attempts bigint, keep_makes bigint, break_attempts bigint, break_makes bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT count(*), COALESCE(sum(legs_for), 0), COALESCE(sum(legs_against), 0), COALESCE(sum(darts_thrown), 0), COALESCE(sum(points_scored), 0),
         CASE WHEN sum(darts_thrown) > 0 THEN sum(points_scored)::numeric / sum(darts_thrown) * 3 ELSE 0 END,
         COALESCE(avg(avg_first9), 0),
         COALESCE(sum(band_60), 0), COALESCE(sum(band_80), 0), COALESCE(sum(band_100), 0), COALESCE(sum(band_120), 0), COALESCE(sum(band_140), 0), COALESCE(sum(band_170), 0), COALESCE(sum(count_180), 0),
         COALESCE(max(high_finish), 0), COALESCE(sum(count_100_finishes), 0),
         min(best_leg_darts), max(worst_leg_darts),
         COALESCE(sum(checkout_attempts), 0), COALESCE(sum(checkout_makes), 0), COALESCE(sum(keep_attempts), 0), COALESCE(sum(keep_makes), 0), COALESCE(sum(break_attempts), 0), COALESCE(sum(break_makes), 0)
  FROM public.match_stat_details WHERE player_id = p_player_id
$function$;

-- ============================================================
-- ДУУТ ЗАРЛАГЧ (caller) — админ дуу бичлэг
-- key = тоо ("1".."180") эсвэл фраз ("p_taniy_onoo","p_aas","p_maximum",
-- "p_checkout","p_bust"). Файл нь caller-voice (public) bucket-д <key>.<ext>.
-- Бичих зөвхөн service role (admin API), унших нийтэд нээлттэй.
-- ============================================================
CREATE TABLE public.caller_clips (
  key TEXT PRIMARY KEY,
  ext TEXT NOT NULL DEFAULT 'webm',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.caller_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caller_clips public read" ON public.caller_clips FOR SELECT USING (true);

-- ============================================================
-- Enable Realtime for online rooms and throws
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.online_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.throws;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_legs;
