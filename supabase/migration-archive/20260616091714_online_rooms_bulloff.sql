-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260616091714
-- Original name: online_rooms_bulloff

-- Bull-off эхлэл: эхлэлийн арга + bulloff дэд-фаз + тоглогчийн bull-off оноо
ALTER TABLE public.online_rooms
  ADD COLUMN IF NOT EXISTS start_method TEXT NOT NULL DEFAULT 'random'
    CHECK (start_method IN ('random', 'bulloff'));

ALTER TABLE public.online_rooms DROP CONSTRAINT IF EXISTS online_rooms_status_check;
ALTER TABLE public.online_rooms ADD CONSTRAINT online_rooms_status_check
  CHECK (status IN ('waiting', 'bulloff', 'ongoing', 'completed'));

ALTER TABLE public.room_players
  ADD COLUMN IF NOT EXISTS bulloff SMALLINT;
