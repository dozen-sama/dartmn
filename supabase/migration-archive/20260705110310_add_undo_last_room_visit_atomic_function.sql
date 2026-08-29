-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260705110310
-- Original name: add_undo_last_room_visit_atomic_function

CREATE OR REPLACE FUNCTION public.undo_last_room_visit(p_room_id UUID, p_user_id UUID)
RETURNS SETOF public.room_visits
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.room_visits rv
  WHERE rv.room_id = p_room_id
    AND rv.created_by = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.room_visits rv2
      WHERE rv2.room_id = rv.room_id AND rv2.seq > rv.seq
    )
  RETURNING rv.*;
$$;
