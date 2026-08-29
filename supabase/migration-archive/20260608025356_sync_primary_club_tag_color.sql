-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260608025356
-- Original name: sync_primary_club_tag_color

CREATE OR REPLACE FUNCTION public.sync_primary_club()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET
      primary_club_id = NEW.club_id,
      primary_club_logo = (SELECT logo_url FROM public.clubs WHERE id = NEW.club_id),
      primary_club_tag  = (SELECT tag FROM public.clubs WHERE id = NEW.club_id),
      primary_club_tag_color = (SELECT tag_color FROM public.clubs WHERE id = NEW.club_id)
    WHERE id = NEW.player_id
      AND primary_club_id IS NULL;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET
      primary_club_id   = (SELECT club_id FROM public.club_members WHERE player_id = OLD.player_id LIMIT 1),
      primary_club_logo = (SELECT c.logo_url FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1),
      primary_club_tag  = (SELECT c.tag FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1),
      primary_club_tag_color = (SELECT c.tag_color FROM public.clubs c JOIN public.club_members cm ON cm.club_id = c.id WHERE cm.player_id = OLD.player_id LIMIT 1)
    WHERE id = OLD.player_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
