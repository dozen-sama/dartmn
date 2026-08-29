-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606020329
-- Original name: add_owner_role


ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['player','club_admin','admin','owner']));

UPDATE public.profiles 
SET role = 'owner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'dnt.tuguldurk@gmail.com');
