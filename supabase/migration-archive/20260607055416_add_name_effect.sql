-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260607055416
-- Original name: add_name_effect

alter table public.profiles add column if not exists name_effect text;
alter table public.clubs add column if not exists name_effect text;
-- Одоо premium хүрээтэй байгаа эзний галыг effect болгож шилжүүлэх
update public.profiles p set name_effect = 'fire'
from auth.users u where u.id = p.id and u.email = 'dnt.tuguldurk@gmail.com';
