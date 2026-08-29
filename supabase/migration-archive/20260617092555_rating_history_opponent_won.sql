-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260617092555
-- Original name: rating_history_opponent_won

-- Профайлын match history-д өрсөлдөгч + хож/ялагдсаныг харуулахын тулд
ALTER TABLE public.rating_history
  ADD COLUMN IF NOT EXISTS opponent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS won boolean;
