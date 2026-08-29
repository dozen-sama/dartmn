-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260703010320
-- Original name: create_practice_sessions

CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN (
    'solo501','checkout_drill','scoring_drill',
    'around_clock_singles','around_clock_doubles','around_clock_trebles',
    'bobs27','checkout121','cricket','shanghai'
  )),
  headline_metric NUMERIC NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX practice_sessions_player_mode_idx
  ON public.practice_sessions (player_id, mode, created_at DESC);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own practice sessions"
  ON public.practice_sessions FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players insert own practice sessions"
  ON public.practice_sessions FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE OR REPLACE FUNCTION public.get_practice_stat_summary(p_player_id uuid)
RETURNS TABLE (
  mode TEXT, session_count INTEGER, best_metric NUMERIC, worst_metric NUMERIC, last_played TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT mode, count(*)::int, max(headline_metric), min(headline_metric), max(created_at)
  FROM public.practice_sessions WHERE player_id = p_player_id GROUP BY mode
$$;
