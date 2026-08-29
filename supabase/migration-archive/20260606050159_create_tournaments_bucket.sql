-- HISTORICAL ARCHIVE ONLY
-- Recovered from live supabase_migrations.schema_migrations
-- DO NOT APPLY after baseline
-- Original version: 20260606050159
-- Original name: create_tournaments_bucket


INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tournaments', 'tournaments', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload tournament images"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tournaments');

CREATE POLICY "Anyone can view tournament images"
ON storage.objects FOR SELECT USING (bucket_id = 'tournaments');

CREATE POLICY "Owner can delete tournament images"
ON storage.objects FOR DELETE USING (bucket_id = 'tournaments');
