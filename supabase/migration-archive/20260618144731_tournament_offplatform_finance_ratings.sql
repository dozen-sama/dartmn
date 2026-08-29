-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618144731
-- Original name: tournament_offplatform_finance_ratings

-- ============================================================
-- Off-platform санхүү + зохион байгуулагчийн үнэлгээ (Phase 3)
-- ============================================================

-- Зохион байгуулагчийн бооцоо хүлээн авах данс (оролцогчдод харуулахаар public)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS organizer_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS organizer_iban TEXT,
  ADD COLUMN IF NOT EXISTS organizer_account_number TEXT,
  ADD COLUMN IF NOT EXISTS organizer_account_holder TEXT;

-- Оролцогчийн шагнал хүлээн авах данс — НУУЦ (зөвхөн өөрөө + зохион байгуулагч)
CREATE TABLE IF NOT EXISTS public.tournament_payout_accounts (
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
CREATE INDEX IF NOT EXISTS payout_accounts_tournament_idx ON public.tournament_payout_accounts (tournament_id);
ALTER TABLE public.tournament_payout_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Payout account: self or organizer reads" ON public.tournament_payout_accounts FOR SELECT USING (
    auth.uid() = player_id
    OR auth.uid() = (SELECT organizer_id FROM public.tournaments t WHERE t.id = tournament_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Payout account: self inserts" ON public.tournament_payout_accounts FOR INSERT WITH CHECK (auth.uid() = player_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Payout account: self updates" ON public.tournament_payout_accounts FOR UPDATE USING (auth.uid() = player_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Зохион байгуулагчийн үнэлгээ (1=гомдол ... 5=сайшаал), нэг тоглогч нэг тэмцээнд нэг
CREATE TABLE IF NOT EXISTS public.organizer_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, rater_id),
  CHECK (rater_id <> organizer_id)
);
CREATE INDEX IF NOT EXISTS organizer_ratings_organizer_idx ON public.organizer_ratings (organizer_id);
ALTER TABLE public.organizer_ratings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Ratings viewable by everyone" ON public.organizer_ratings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Rater inserts own rating" ON public.organizer_ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Rater updates own rating" ON public.organizer_ratings FOR UPDATE USING (auth.uid() = rater_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
