-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260619124946
-- Original name: tournaments_allow_groups_knockout_bracket

ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_bracket_type_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_bracket_type_check
  CHECK (bracket_type = ANY (ARRAY['single_elimination'::text, 'double_elimination'::text, 'round_robin'::text, 'groups_knockout'::text, 'swiss'::text]));
