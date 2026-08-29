-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260619131751
-- Original name: advance_tournament_match_swiss_no_autocomplete

CREATE OR REPLACE FUNCTION public.advance_tournament_match(p_match_id uuid, p_winning_side smallint, p_side1_legs integer, p_side2_legs integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m public.tournament_matches;
  v_winner uuid;
  v_loser uuid;
  v_bracket text;
  v_remaining int;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.status = 'completed' THEN RETURN; END IF;

  v_winner := CASE WHEN p_winning_side = 1 THEN m.side1_entrant_id ELSE m.side2_entrant_id END;
  v_loser  := CASE WHEN p_winning_side = 1 THEN m.side2_entrant_id ELSE m.side1_entrant_id END;

  UPDATE public.tournament_matches
    SET status = 'completed', winner_entrant_id = v_winner, loser_entrant_id = v_loser,
        side1_legs = p_side1_legs, side2_legs = p_side2_legs
    WHERE id = p_match_id;

  IF m.next_match_id IS NOT NULL AND v_winner IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_winner ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_winner ELSE side2_entrant_id END
      WHERE id = m.next_match_id;
  END IF;

  IF m.next_loser_match_id IS NOT NULL AND v_loser IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_loser ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_loser ELSE side2_entrant_id END
      WHERE id = m.next_loser_match_id;
  END IF;

  SELECT bracket_type INTO v_bracket FROM public.tournaments WHERE id = m.tournament_id;

  IF v_bracket = 'round_robin' THEN
    -- Бүх match дуусахад л тэмцээн дуусна
    SELECT count(*) INTO v_remaining FROM public.tournament_matches
      WHERE tournament_id = m.tournament_id AND status <> 'completed';
    IF v_remaining = 0 THEN
      UPDATE public.tournaments SET status = 'completed'
        WHERE id = m.tournament_id AND status <> 'completed';
    END IF;
  ELSIF v_bracket = 'swiss' THEN
    -- Авто-дуусгахгүй: тойргийн тоог зохион байгуулагч шийднэ (/finish route).
    NULL;
  ELSE
    -- SE/DE/groups: дэвших заагчгүй, losers бус, бүлгийн бус match = финал
    IF m.next_match_id IS NULL AND m.is_losers_bracket = false AND m.group_no IS NULL THEN
      UPDATE public.tournaments SET status = 'completed'
        WHERE id = m.tournament_id AND status <> 'completed';
    END IF;
  END IF;
END; $function$
