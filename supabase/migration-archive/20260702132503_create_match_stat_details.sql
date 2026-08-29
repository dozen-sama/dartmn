-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260702132503
-- Original name: create_match_stat_details

CREATE TABLE public.match_stat_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opponent_name TEXT NOT NULL,
  won BOOLEAN NOT NULL,
  legs_for SMALLINT NOT NULL,
  legs_against SMALLINT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('online', 'local')),
  room_id UUID REFERENCES public.online_rooms(id) ON DELETE SET NULL,
  local_session_id TEXT,
  local_match_id TEXT,
  tournament_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  context_label TEXT,
  match_key TEXT NOT NULL,
  format TEXT NOT NULL,
  double_out BOOLEAN NOT NULL,
  darts_thrown INTEGER NOT NULL,
  points_scored INTEGER NOT NULL,
  avg3 NUMERIC NOT NULL,
  avg_first9 NUMERIC NOT NULL,
  band_60 SMALLINT NOT NULL DEFAULT 0,
  band_80 SMALLINT NOT NULL DEFAULT 0,
  band_100 SMALLINT NOT NULL DEFAULT 0,
  band_120 SMALLINT NOT NULL DEFAULT 0,
  band_140 SMALLINT NOT NULL DEFAULT 0,
  band_170 SMALLINT NOT NULL DEFAULT 0,
  count_180 SMALLINT NOT NULL DEFAULT 0,
  high_finish SMALLINT NOT NULL DEFAULT 0,
  count_100_finishes SMALLINT NOT NULL DEFAULT 0,
  best_leg_darts SMALLINT,
  worst_leg_darts SMALLINT,
  checkout_attempts SMALLINT NOT NULL DEFAULT 0,
  checkout_makes SMALLINT NOT NULL DEFAULT 0,
  keep_attempts SMALLINT NOT NULL DEFAULT 0,
  keep_makes SMALLINT NOT NULL DEFAULT 0,
  break_attempts SMALLINT NOT NULL DEFAULT 0,
  break_makes SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, match_key)
);

ALTER TABLE public.match_stat_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match stat details viewable by everyone" ON public.match_stat_details FOR SELECT USING (true);

CREATE INDEX match_stat_details_player_idx ON public.match_stat_details (player_id, created_at DESC);
CREATE INDEX match_stat_details_room_idx ON public.match_stat_details (room_id) WHERE room_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_player_stat_summary(p_player_id uuid)
RETURNS TABLE (
  matches bigint, legs_for bigint, legs_against bigint,
  darts_thrown bigint, points_scored bigint, avg3 numeric, avg_first9 numeric,
  band_60 bigint, band_80 bigint, band_100 bigint, band_120 bigint, band_140 bigint, band_170 bigint, count_180 bigint,
  high_finish int, count_100_finishes bigint,
  best_leg_darts int, worst_leg_darts int,
  checkout_attempts bigint, checkout_makes bigint,
  keep_attempts bigint, keep_makes bigint, break_attempts bigint, break_makes bigint
)
LANGUAGE sql STABLE AS $$
  SELECT count(*), sum(legs_for), sum(legs_against), sum(darts_thrown), sum(points_scored),
         CASE WHEN sum(darts_thrown) > 0 THEN sum(points_scored)::numeric / sum(darts_thrown) * 3 ELSE 0 END,
         COALESCE(avg(avg_first9), 0),
         sum(band_60), sum(band_80), sum(band_100), sum(band_120), sum(band_140), sum(band_170), sum(count_180),
         COALESCE(max(high_finish), 0), sum(count_100_finishes),
         min(best_leg_darts), max(worst_leg_darts),
         sum(checkout_attempts), sum(checkout_makes), sum(keep_attempts), sum(keep_makes), sum(break_attempts), sum(break_makes)
  FROM public.match_stat_details WHERE player_id = p_player_id
$$;
