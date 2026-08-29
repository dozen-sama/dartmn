-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260618165859
-- Original name: organizer_ratings_require_participation

-- Хуурамч хаягнаас хамгаалах: үнэлгээ өгөхийн тулд тухайн тэмцээнд бүртгэгдсэн
-- оролцогч байх ёстой. UNIQUE(tournament_id, rater_id) нь нэг хаяг нэг үнэлгээг хангана.
DROP POLICY IF EXISTS "Rater inserts own rating" ON public.organizer_ratings;
CREATE POLICY "Rater inserts own rating" ON public.organizer_ratings FOR INSERT WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1 FROM public.tournament_registrations r
    WHERE r.tournament_id = organizer_ratings.tournament_id AND r.player_id = auth.uid()
  )
);
