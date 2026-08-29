-- =============================================================================
-- ROLLBACK for supabase/migrations/20260829_security_hotfix_rpc_storage.sql
-- NOT auto-applied. NOT placed in supabase/migrations/ on purpose, so CLI/db
-- push tooling never picks it up automatically. Run manually only if the
-- hotfix must be reverted.
--
-- Restores exact pre-hotfix state, captured live from `mongol-darts`
-- (idomtybdmqhsxbuttubk) on 2026-08-29 before the hotfix was applied.
-- =============================================================================

-- 1. Restore original EXECUTE grants (PUBLIC/anon/authenticated/postgres/service_role
--    all had EXECUTE on every function below).

GRANT EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_score(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_avraga_on_tournament_complete() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_achievement() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_club_joined() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_club_tier_up() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_tournament_registered() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_tournament_status() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_profile_stats_change() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_rating_change() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_club_logo_to_members() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_primary_club() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_member_count() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tournament_player_count() TO PUBLIC, anon, authenticated;

-- 2. Restore original function bodies (no SET search_path clause).

CREATE OR REPLACE FUNCTION public.check_achievements(p_player_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  p RECORD;
  newly_earned TEXT[] := '{}';
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_player_id;
  IF NOT FOUND THEN RETURN newly_earned; END IF;

  IF p.matches_played >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_match') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_match'); END IF;
  END IF;

  IF p.matches_won >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_win') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_win'); END IF;
  END IF;

  IF p.matches_won >= 10 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_10') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_10'); END IF;
  END IF;

  IF p.matches_won >= 50 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_50'); END IF;
  END IF;

  IF p.matches_won >= 100 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_100'); END IF;
  END IF;

  IF p.matches_won >= 500 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'wins_500') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'wins_500'); END IF;
  END IF;

  IF p.count_180 >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_180') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_180'); END IF;
  END IF;

  IF p.count_180 >= 10 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, '180_times_10') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, '180_times_10'); END IF;
  END IF;

  IF p.count_180 >= 50 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, '180_times_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, '180_times_50'); END IF;
  END IF;

  IF p.highest_checkout >= 100 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_100'); END IF;
  END IF;

  IF p.highest_checkout >= 150 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_150') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_150'); END IF;
  END IF;

  IF p.highest_checkout >= 170 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'checkout_170') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'checkout_170'); END IF;
  END IF;

  IF p.tournament_wins >= 1 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'first_champion') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'first_champion'); END IF;
  END IF;

  IF p.tournament_wins >= 5 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'champion_5') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'champion_5'); END IF;
  END IF;

  IF p.rating_points >= 1000 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_bronze') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_bronze'); END IF;
  END IF;

  IF p.rating_points >= 1400 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_gold') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_gold'); END IF;
  END IF;

  IF p.rating_points >= 1800 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_diamond') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_diamond'); END IF;
  END IF;

  IF p.rating_points >= 2000 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_master') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_master'); END IF;
  END IF;

  IF p.rating_points >= 2200 THEN
    INSERT INTO public.player_achievements (player_id, achievement_key)
    VALUES (p_player_id, 'tier_grandmaster') ON CONFLICT DO NOTHING;
    IF FOUND THEN newly_earned := array_append(newly_earned, 'tier_grandmaster'); END IF;
  END IF;

  RETURN newly_earned;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_premium_status(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET
    is_premium = EXISTS (
      SELECT 1 FROM public.player_subscriptions
      WHERE player_id = p_player_id
        AND status = 'active'
        AND expires_at > NOW()
    ),
    premium_expires_at = (
      SELECT expires_at FROM public.player_subscriptions
      WHERE player_id = p_player_id AND status = 'active' AND expires_at > NOW()
      ORDER BY expires_at DESC LIMIT 1
    )
  WHERE id = p_player_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_club_score(p_club_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  avg_rating NUMERIC;
  member_cnt INTEGER;
BEGIN
  SELECT AVG(pr.rating_points), COUNT(*)
  INTO avg_rating, member_cnt
  FROM public.club_members cm
  JOIN public.profiles pr ON pr.id = cm.player_id
  WHERE cm.club_id = p_club_id;

  UPDATE public.clubs
  SET club_score = COALESCE(ROUND(avg_rating), 0)
  WHERE id = p_club_id;
END;
$function$;

-- Re-assert grants after CREATE OR REPLACE (same rationale as forward migration).
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_score(uuid) TO PUBLIC, anon, authenticated;

-- 3. Restore original storage.objects policies (tournaments, clubs buckets).

DROP POLICY IF EXISTS "Tournament banner upload by owner path" ON storage.objects;
DROP POLICY IF EXISTS "Tournament banner update by owner path" ON storage.objects;
DROP POLICY IF EXISTS "Tournament banner delete by owner path" ON storage.objects;

CREATE POLICY "Anyone can upload tournament images"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'tournaments');

CREATE POLICY "Owner can delete tournament images"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'tournaments');

DROP POLICY IF EXISTS "Club image upload by owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "Club image update by owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "Club image delete by owner or admin" ON storage.objects;

CREATE POLICY "Club owners can upload"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'clubs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Club owners can update"
ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'clubs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Club owners can delete"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'clubs' AND auth.uid() IS NOT NULL);

-- 4. Restore province_rankings view to non-invoker (original state: option not set).

ALTER VIEW public.province_rankings RESET (security_invoker);
