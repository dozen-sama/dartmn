-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260829091702
-- Original name: security_hotfix_rpc_storage

-- =============================================================================
-- DartMN Security Hotfix — Phase A
-- Date: 2026-08-29
-- Scope: SECURITY DEFINER RPC EXECUTE grants + storage.objects RLS policies
--        (tournaments, clubs buckets) + province_rankings view + search_path
--        pinning on the 3 in-scope trigger-adjacent functions that lacked it.
-- =============================================================================

-- 1. REVOKE direct client EXECUTE on CRITICAL/HIGH SECURITY DEFINER RPCs.
REVOKE EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) TO service_role;

-- 2. REVOKE direct client EXECUTE on lower-impact SECURITY DEFINER RPCs.
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_club_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_club_score(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;

-- 3. Pin search_path on the 3 in-scope SECURITY DEFINER functions missing it.
CREATE OR REPLACE FUNCTION public.check_achievements(p_player_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
 SET search_path TO 'public'
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
 SET search_path TO 'public'
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

REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_club_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_club_score(uuid) TO service_role;

-- 4. Trigger-function EXECUTE grant hygiene (Step 7).
REVOKE EXECUTE ON FUNCTION public.check_avraga_on_tournament_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_achievement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_club_joined() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_club_tier_up() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tournament_registered() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tournament_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_profile_stats_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_rating_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_club_logo_to_members() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_club() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_club_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_tournament_player_count() FROM PUBLIC, anon, authenticated;

-- 5. Storage policies — `tournaments` bucket.
DROP POLICY IF EXISTS "Anyone can upload tournament images" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete tournament images" ON storage.objects;

CREATE POLICY "Tournament banner upload by owner path"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tournaments'
  AND name LIKE 'banners/' || (auth.uid())::text || '-%'
);

CREATE POLICY "Tournament banner update by owner path"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tournaments'
  AND name LIKE 'banners/' || (auth.uid())::text || '-%'
)
WITH CHECK (
  bucket_id = 'tournaments'
  AND name LIKE 'banners/' || (auth.uid())::text || '-%'
);

CREATE POLICY "Tournament banner delete by owner path"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tournaments'
  AND name LIKE 'banners/' || (auth.uid())::text || '-%'
);

-- 6. Storage policies — `clubs` bucket.
DROP POLICY IF EXISTS "Club owners can upload" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can update" ON storage.objects;
DROP POLICY IF EXISTS "Club owners can delete" ON storage.objects;

CREATE POLICY "Club image upload by owner or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clubs'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = c.id AND cm.player_id = auth.uid() AND cm.role = 'admin'
        )
      )
  )
);

CREATE POLICY "Club image update by owner or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clubs'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = c.id AND cm.player_id = auth.uid() AND cm.role = 'admin'
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'clubs'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = c.id AND cm.player_id = auth.uid() AND cm.role = 'admin'
        )
      )
  )
);

CREATE POLICY "Club image delete by owner or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clubs'
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = c.id AND cm.player_id = auth.uid() AND cm.role = 'admin'
        )
      )
  )
);

-- 7. province_rankings view — MEDIUM (Advisor security_definer_view ERROR).
ALTER VIEW public.province_rankings SET (security_invoker = true);
