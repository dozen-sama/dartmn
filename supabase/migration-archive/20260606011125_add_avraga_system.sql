-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606011125
-- Original name: add_avraga_system


-- profiles дээр avraga_wins нэмэх (32+ тоглогчтой тэмцээнд хожсон тоо)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avraga_wins integer NOT NULL DEFAULT 0;

-- Тэмцээний эцсийн тоглолт дуусч winner тодорхойлогдоход Аврага шалгах function
CREATE OR REPLACE FUNCTION public.check_avraga_on_tournament_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t_player_count integer;
  t_winner_id uuid;
BEGIN
  -- Зөвхөн status 'completed' болсон тэмцээнд хэрэглэнэ
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Тэмцээний бодит тоглогчийн тоо
    SELECT COUNT(*) INTO t_player_count
    FROM tournament_registrations
    WHERE tournament_id = NEW.id;

    -- 32+ тоглогчтой бол эцсийн match-ийн ялагчийг олно
    IF t_player_count >= 32 THEN
      SELECT m.winner_id INTO t_winner_id
      FROM matches m
      WHERE m.tournament_id = NEW.id
        AND m.round = (SELECT MAX(round) FROM matches WHERE tournament_id = NEW.id)
        AND m.winner_id IS NOT NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      IF t_winner_id IS NOT NULL THEN
        UPDATE public.profiles
        SET avraga_wins = avraga_wins + 1
        WHERE id = t_winner_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger үүсгэх
DROP TRIGGER IF EXISTS on_tournament_completed ON public.tournaments;
CREATE TRIGGER on_tournament_completed
  AFTER UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION check_avraga_on_tournament_complete();
