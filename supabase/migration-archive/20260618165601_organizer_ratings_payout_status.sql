-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618165601
-- Original name: organizer_ratings_payout_status

-- Үнэлгээнд шагнал төлсөн эсэх (winner-ийн баталгаа). NULL = хамаарахгүй (хожоогүй).
ALTER TABLE public.organizer_ratings
  ADD COLUMN IF NOT EXISTS payout_status TEXT CHECK (payout_status IN ('paid', 'unpaid'));
