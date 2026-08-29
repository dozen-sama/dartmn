-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260616081931
-- Original name: online_rooms_rule_options

-- Онлайн өрөөнд дартсын дүрмийн сонголтууд: visit/round хязгаар, bull finish, 170 формат
ALTER TABLE public.online_rooms
  ADD COLUMN IF NOT EXISTS limit_rounds SMALLINT,
  ADD COLUMN IF NOT EXISTS bull_finish BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.online_rooms DROP CONSTRAINT IF EXISTS online_rooms_format_check;
ALTER TABLE public.online_rooms ADD CONSTRAINT online_rooms_format_check
  CHECK (format IN ('501', '301', '170', 'cricket'));
