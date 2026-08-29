-- =============================================================================
-- DartMN Security Hotfix — Phase A
-- Date: 2026-08-29
-- Scope: SECURITY DEFINER RPC EXECUTE grants + storage.objects RLS policies
--        (tournaments, clubs buckets) + province_rankings view + search_path
--        pinning on the 3 in-scope trigger-adjacent functions that lacked it.
--
-- Context: DARTMN_SUPABASE_SCHEMA_AUDIT.md (2026-08-28) found that several
-- SECURITY DEFINER RPCs were EXECUTE-granted to anon/authenticated/PUBLIC with
-- no caller-ownership check in the function body, and that two storage buckets
-- had policies with no auth/ownership check at all. This migration closes
-- those gaps by revoking direct client EXECUTE access (every legitimate call
-- site already goes through a service-role admin client from a Next.js server
-- route — see report §2 call-site inventory) and by rewriting the storage
-- policies to check real ownership derived from the app's actual upload path
-- conventions.
--
-- This migration is NOT a baseline. It is a forward-only hotfix on top of
-- whatever schema state currently exists on the live project. See report §12.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REVOKE direct client EXECUTE on CRITICAL/HIGH SECURITY DEFINER RPCs.
--    All legitimate callers already use createAdminClient() (service_role)
--    from Next.js server routes — see report §2. No client ever calls these
--    with .rpc() over the anon/authenticated Data API.
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_match_result(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.advance_tournament_match(uuid, smallint, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.start_tournament(uuid, jsonb, jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.seed_knockout(uuid, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. REVOKE direct client EXECUTE on lower-impact SECURITY DEFINER RPCs
--    (check_achievements, update_club_score, refresh_premium_status).
--    Same rationale: no client-side call site found anywhere in the codebase;
--    check_achievements and update_club_score are called internally by
--    apply_match_result / on_rating_change respectively — those internal
--    PERFORM calls execute as the owning role (postgres) and are unaffected
--    by revoking anon/authenticated/PUBLIC grants.
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_club_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_club_score(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Pin search_path on the 3 in-scope SECURITY DEFINER functions that were
--    missing it (function_search_path_mutable advisor WARN). Bodies are
--    reproduced verbatim from pg_get_functiondef(); only the SET clause is
--    added. Logic unchanged.
-- -----------------------------------------------------------------------------

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

-- Re-apply REVOKE after CREATE OR REPLACE, since Postgres resets a function's
-- grants to the default (PUBLIC EXECUTE) whenever it doesn't preserve ACL —
-- CREATE OR REPLACE actually preserves existing grants, but we re-assert
-- explicitly here so this migration is correct even if run standalone/out of
-- order relative to section 2.
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_achievements(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_club_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_club_score(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Trigger-function EXECUTE grant hygiene (Step 7).
--    These are all SECURITY DEFINER functions with RETURNS trigger. Postgres
--    invokes trigger functions internally as part of the trigger mechanism —
--    that invocation is NOT subject to EXECUTE privilege checks. A direct
--    SQL-level call (e.g. `select public.handle_new_user()`) already fails
--    with "trigger functions can only be called as triggers" regardless of
--    grants. Revoking anon/authenticated/PUBLIC EXECUTE here is pure
--    permission hygiene and cannot affect trigger firing.
--    (update_updated_at / update_updated_at_column are NOT SECURITY DEFINER
--    and are left untouched — no RLS-bypass risk, out of scope.)
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 5. Storage policies — `tournaments` bucket.
--    Actual app upload path convention (CreateTournamentForm.tsx):
--      banners/<uploader_user_id>-<timestamp>.<ext>
--    The image is uploaded from the tournament CREATE form, before the
--    tournament row exists, so there is no tournament_id to key ownership on.
--    The only reliable ownership signal is the uploader's own auth.uid()
--    embedded in the filename by the client. Policy enforces that a caller
--    may only write/delete objects whose filename carries their own uid.
-- -----------------------------------------------------------------------------

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

-- SELECT ("Anyone can view tournament images") is intentionally left as-is —
-- public read is the intended design and was not part of the vulnerability.

-- -----------------------------------------------------------------------------
-- 6. Storage policies — `clubs` bucket.
--    Actual app upload path convention (ImageUpload.tsx via clubs/[id]/edit):
--      <club_id>/logo.<ext>?t=<timestamp>
--      <club_id>/cover.<ext>?t=<timestamp>
--    Authorized roles mirror the existing `clubs` table RLS ("Club owners can
--    update" / "Club deputies can update"): clubs.owner_id = auth.uid() OR
--    club_members.role = 'admin' for that club. Plain members are NOT
--    authorized (matches clubs/[id]/edit/page.tsx client-side gate).
-- -----------------------------------------------------------------------------

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

-- SELECT ("Club images public read") is intentionally left as-is.

-- -----------------------------------------------------------------------------
-- 7. province_rankings view — MEDIUM (Advisor security_definer_view ERROR).
--    Underlying table (profiles) has a public USING(true) SELECT policy, so
--    switching to security_invoker changes nothing about who can read what —
--    it only stops the view from silently bypassing RLS for any future,
--    less-permissive profiles policy. View is not referenced anywhere in the
--    app codebase (grep confirmed) — zero regression surface.
-- -----------------------------------------------------------------------------

ALTER VIEW public.province_rankings SET (security_invoker = true);
