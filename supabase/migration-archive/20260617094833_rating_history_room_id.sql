-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260617094833
-- Original name: rating_history_room_id

-- Онлайн тоглолтын дэлгэрэнгүй (дуусгалын самбар) руу холбохын тулд
ALTER TABLE public.rating_history
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.online_rooms(id) ON DELETE SET NULL;
