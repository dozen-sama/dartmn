-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606004638
-- Original name: fix_handle_new_user_conflict


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    split_part(NEW.email, '@', 1)
  );
  final_username := base_username;

  -- username давхцвал дугаар нэмж өвөрмөц болгоно
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), final_username)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
