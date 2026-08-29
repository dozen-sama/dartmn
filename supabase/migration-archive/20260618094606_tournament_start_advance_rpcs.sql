-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618094606
-- Original name: tournament_start_advance_rpcs

-- next_match_id/next_loser_match_id нь нэг INSERT дотор хожуу round-уудыг заадаг тул
-- self-FK-уудыг DEFERRABLE болгож, шалгалтыг транзакцийн төгсгөлд хийнэ.
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

-- ── start_tournament ────────────────────────────────────────────────────────
-- Урьдчилан (TS, bracket-server.ts) бэлдсэн entrant/match-уудыг нэг транзакцид
-- хийж, status → ongoing. Зөвхөн эхлээгүй тэмцээнд (claim-first).
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
    WHERE id = p_tournament_id AND status IN ('draft', 'registration');
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

-- ── advance_tournament_match ────────────────────────────────────────────────
-- Match-г дуусгаж, ялагчийг next_match-ийн нээлттэй тал руу (DE үед ялагдагчийг
-- next_loser_match руу) шилжүүлнэ. claim-first (давхар дэвшихээс сэргийлнэ).
-- p_winning_side: 1 = side1, 2 = side2.
CREATE OR REPLACE FUNCTION public.advance_tournament_match(
  p_match_id uuid,
  p_winning_side smallint,
  p_side1_legs int,
  p_side2_legs int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.tournament_matches;
  v_winner uuid;
  v_loser uuid;
BEGIN
  SELECT * INTO m FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR m.status = 'completed' THEN RETURN; END IF;

  v_winner := CASE WHEN p_winning_side = 1 THEN m.side1_entrant_id ELSE m.side2_entrant_id END;
  v_loser  := CASE WHEN p_winning_side = 1 THEN m.side2_entrant_id ELSE m.side1_entrant_id END;

  UPDATE public.tournament_matches
    SET status = 'completed', winner_entrant_id = v_winner, loser_entrant_id = v_loser,
        side1_legs = p_side1_legs, side2_legs = p_side2_legs
    WHERE id = p_match_id;

  -- Ялагч → дараагийн match-ийн эхний нээлттэй тал (SET нь хуучин утгаар тооцно)
  IF m.next_match_id IS NOT NULL AND v_winner IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_winner ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_winner ELSE side2_entrant_id END
      WHERE id = m.next_match_id;
  END IF;

  -- DE: ялагдагч → losers bracket (Phase 2-д бүрэн ашиглагдана)
  IF m.next_loser_match_id IS NOT NULL AND v_loser IS NOT NULL THEN
    UPDATE public.tournament_matches SET
      side1_entrant_id = CASE WHEN side1_entrant_id IS NULL THEN v_loser ELSE side1_entrant_id END,
      side2_entrant_id = CASE WHEN side1_entrant_id IS NOT NULL AND side2_entrant_id IS NULL THEN v_loser ELSE side2_entrant_id END
      WHERE id = m.next_loser_match_id;
  END IF;

  -- Финал (next_match_id null, winners bracket) дуусвал тэмцээн дуусна
  IF m.next_match_id IS NULL AND m.is_losers_bracket = false THEN
    UPDATE public.tournaments SET status = 'completed'
      WHERE id = m.tournament_id AND status <> 'completed';
  END IF;
END; $$;
