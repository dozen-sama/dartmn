-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606005521
-- Original name: fix_club_member_count_sync


-- Trigger-ийг COUNT дээр суурилсан болгох (increment/decrement нь sync алдах эрсдэлтэй)
CREATE OR REPLACE FUNCTION public.update_club_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_club_id uuid;
BEGIN
  target_club_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.club_id ELSE NEW.club_id END;

  UPDATE public.clubs
  SET member_count = (
    SELECT COUNT(*) FROM public.club_members WHERE club_id = target_club_id
  )
  WHERE id = target_club_id;

  RETURN NULL;
END;
$$;

-- Одоогийн бүх клубын member_count-ийг бодит тооноос дахин тооцоолох
UPDATE public.clubs c
SET member_count = (
  SELECT COUNT(*) FROM public.club_members cm WHERE cm.club_id = c.id
);
