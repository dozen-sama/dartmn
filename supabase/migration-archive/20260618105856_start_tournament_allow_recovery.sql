-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618105856
-- Original name: start_tournament_allow_recovery

-- bracket-гүй ongoing тэмцээнийг сэргээж эхлүүлэх боломжтой болгоно (route нь
-- matches тоогоор давхар эхлүүлэлтээс хамгаална).
CREATE OR REPLACE FUNCTION public.start_tournament(
  p_tournament_id uuid,
  p_entrants jsonb,
  p_entrant_players jsonb,
  p_matches jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.tournaments SET status = 'ongoing'
    WHERE id = p_tournament_id AND status IN ('draft', 'registration', 'ongoing');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament % not startable (wrong status)', p_tournament_id;
  END IF;

  INSERT INTO public.tournament_entrants (id, tournament_id, display_name, seed, group_no)
  SELECT (e->>'id')::uuid, p_tournament_id, e->>'display_name', (e->>'seed')::int,
         NULLIF(e->>'group_no','')::int
  FROM jsonb_array_elements(p_entrants) e;

  INSERT INTO public.tournament_entrant_players (entrant_id, player_id, slot)
  SELECT (ep->>'entrant_id')::uuid, (ep->>'player_id')::uuid, (ep->>'slot')::smallint
  FROM jsonb_array_elements(p_entrant_players) ep;

  INSERT INTO public.tournament_matches
    (id, tournament_id, round, match_number, is_losers_bracket, group_no,
     side1_entrant_id, side2_entrant_id, side1_legs, side2_legs,
     winner_entrant_id, loser_entrant_id, status, next_match_id, next_loser_match_id)
  SELECT (m->>'id')::uuid, p_tournament_id, (m->>'round')::int, (m->>'match_number')::int,
         (m->>'is_losers_bracket')::boolean, NULLIF(m->>'group_no','')::int,
         NULLIF(m->>'side1_entrant_id','')::uuid, NULLIF(m->>'side2_entrant_id','')::uuid,
         (m->>'side1_legs')::int, (m->>'side2_legs')::int,
         NULLIF(m->>'winner_entrant_id','')::uuid, NULLIF(m->>'loser_entrant_id','')::uuid,
         m->>'status', NULLIF(m->>'next_match_id','')::uuid, NULLIF(m->>'next_loser_match_id','')::uuid
  FROM jsonb_array_elements(p_matches) m;
END; $$;
